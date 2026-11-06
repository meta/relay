/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

use std::cell::UnsafeCell;
use std::fmt;
use std::fmt::Debug;
use std::fmt::Display;
use std::marker::PhantomData;
use std::mem::ManuallyDrop;
use std::mem::MaybeUninit;
use std::num::NonZeroU32;
use std::ptr;
use std::ptr::NonNull;
use std::sync::atomic::AtomicPtr;
use std::sync::atomic::AtomicU32;
use std::sync::atomic::Ordering;

use parking_lot::Mutex;

const MIN_SHIFT: u32 = 7;
const U32_BITS: usize = 32;
const MIN_SIZE: u32 = 1 << MIN_SHIFT;
const NUM_SIZES: usize = U32_BITS - MIN_SHIFT as usize;
const MAX_INDEX: u32 = u32::MAX - MIN_SIZE;

// Memory consistency assertions provide a lot of checking of the internals,
// but have a huge runtime cost.  Be warned!  These are really for active
// debugging of atomic_arena itself.
macro_rules! memory_consistency_assert {
    ($($arg:tt)*) => (if cfg!(memory_consistency_assertions) { assert!($($arg)*); })
}

macro_rules! memory_consistency_assert_eq {
    ($($arg:tt)*) => (if cfg!(memory_consistency_assertions) { assert_eq!($($arg)*); })
}

/// `AtomicArena<'a, T>` is a nearly-lock-free arena of `T`.  It offers O(1)
/// lock-free `get` and O(1) nearly lock-free `add`, and can be accessed
/// through the `Ref<'a, T>` type which is internally stored as `NonZeroU32`.
/// This means that `Ref<...>` and `Option<Ref<...>>` both take 4 bytes.
///
/// It is unsafe to get a `Ref` that was not produced by `add` to the same
/// `AtomicArena`; the type arguments on `Ref` and `AtomicArena` are intended
/// to enforce that separation.
///
/// How it works
///
/// Internally, `AtomicArena` uses a telescoping array of buckets, arranged in
/// reverse order.  The last bucket holds the first `MIN_SIZE` objects
/// allocated, and each bucket in use holds twice as many objects as the one
/// above it.  So when `MIN_SIZE` = 128, initially things look like this:
/// ```ignore
/// next_biased_index: 128
/// buckets:
///   +----+
///   |    |
///   |  0 | null
///   +----+
///   |    |
///   |  1 | null
///   +----+
///   :  : :
///   +----+
///   |    |
///   | 23 | null
///   +----+
///   |    |     +--+--+....--------------------------+
///   | 24 | --> |  |  | array of 128 uninitialized T |
///   +----+     +--+--+....--------------------------+
/// ```
/// After allocating 537 objects, things look as follows:
/// ```ignore
/// next_biased_index: 665 = 537 + 128
/// buckets:
///   +----+
///   |  0 | null
///   +----+
///   |  1 | null
///   +----+
///   :  : :
///   +----+
///   |    |                                 Ref 664
///   | 21 | null                            |
///   +----+                                 v
///   |    |     +--+--+....----------------+--+-------------------------------+
///   | 22 | --> |  |  | objects 512 -- 663 |  | empty entries 665 -- 1023     |
///   +----+     +--+--+....----------------+--+-------------------------------+
///   |    |     +--+--+....-----------------------------------+
///   | 23 | --> |  |  | objects for Refs 256 -- 511           |
///   +----+     +--+--+....-----------------------------------+
///   |    |     +--+--+....--------------------------+
///   | 24 | --> |  |  | objects for Refs 128 -- 255  |
///   +----+     +--+--+....--------------------------+
///               ^  ^
///      Ref 128 -'  `- Ref 129
/// ```
///
/// Note that the first object allocted gets index `MIN_SIZE`, and that we cap
/// the extra space allocated for currently empty entries at
/// `2 * len() + MIN_SIZE - 1`.
///
/// Why are the buckets in reverse order like this?  It's for ease of index
/// computation in `get()`.  In particular, note that the bucket index is equal
/// to the number of leading zeros in the `Ref`, and the offset in the bucket
/// is the trailing bits of the Ref after clearing the topmost 1 bit.
/// We could waste somewhat less storage than this with some more bit
/// trickery, but this is currently good enough for our purposes.
///
/// In the common case, allocation is simply a matter of atomically
/// incrementing `next_biased_index` and initializing the empty entry.  When a
/// bucket fills (we discover the bucket pointer we fetched is null in
/// `slice_for_slot`), we fall back to locking in `slice_for_slot_slow` by
/// taking the `bucket_alloc_mutex`.  This re-checks the entry in `buckets` and
/// allocates a fresh bucket if it's still empty.
pub struct AtomicArena<'a, T> {
    phantom_life: PhantomData<&'a ()>,
    next_biased_index: AtomicU32,
    /// buckets in reverse order, starting from the back and working
    /// forwards.  Capacity for bucket i is bucket_capacity(i).
    buckets: [AtomicPtr<MaybeUninit<T>>; NUM_SIZES],
    bucket_alloc_mutex: Mutex<()>,
}

/// `Ref<'a, T>` is a 32-bit nonzero reference to an object of type `T` held in
/// the `AtomicArena<'a, T>`.  It acts similar to `&'a T` in that it is `Copy`
/// and `Clone` regardless of `T` and dereferences via `arena.get(...)` to `&T`.
#[derive(PartialEq, Eq, PartialOrd, Ord, Hash)]
#[repr(transparent)] // Same repr & ABI as NonZeroU32 & u32.
pub struct Ref<'a, T> {
    phantom: PhantomData<T>,
    phantom_life: PhantomData<&'a ()>,
    biased_index: NonZeroU32,
}

/// `Ref<'a, T>` requires manual implementations of `Clone` and `Copy` since `T` is a
/// phantom parameter and not required to support `Clone` or `Copy`.
impl<'a, T> Clone for Ref<'a, T> {
    fn clone(&self) -> Self {
        *self
    }
}

impl<'a, T> Copy for Ref<'a, T> {}

impl<'a, T> Ref<'a, T> {
    /// Gets an index suitable for array indexing out of a `Ref<'a, T>`.
    /// The resulting index *is* 0-based, and < the corresponding
    /// `arena.len()`.
    pub fn index(&self) -> u32 {
        self.biased_index.get() - MIN_SIZE // Unbias to be 0-based.
    }

    /// Re-create ref from biased index.
    pub unsafe fn from_index(index: u32) -> Self {
        unsafe {
            // OK because MIN_SIZE must be > 0 for algorithmic correctness.
            Self::from_raw(NonZeroU32::new_unchecked(index + MIN_SIZE))
        }
    }

    /// Internal value of ref; only use this if you know what you're
    /// doing.  Actually `>= MIN_SIZE`.
    pub(crate) fn raw(&self) -> NonZeroU32 {
        self.biased_index
    }

    /// Re-create ref from raw index.
    pub unsafe fn from_raw(biased_index: NonZeroU32) -> Self {
        Ref {
            phantom: PhantomData,
            phantom_life: PhantomData,
            biased_index,
        }
    }

    /// Very unsafe rebranding of one ref type into another.
    /// Use for serialization / deserialization of refs.
    pub(crate) unsafe fn rebrand<'b, U>(&self) -> Ref<'b, U> {
        Ref {
            phantom: PhantomData,
            phantom_life: PhantomData,
            biased_index: self.biased_index,
        }
    }
}

impl<'a, T> Debug for Ref<'a, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "atomic_arena::Ref({:?})", self.biased_index)
    }
}

impl<'a, T> Display for Ref<'a, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "#{}", self.index())
    }
}

/// Capacity of bucket at bucket index `a`.
fn bucket_capacity(a: usize) -> usize {
    (1 << 31) >> (a as u32)
}

/// Transform external biased index `i` into (bucket index, index in bucket)
fn index(i: u32) -> (usize, usize) {
    memory_consistency_assert!(i >= MIN_SIZE);
    memory_consistency_assert!(i - MIN_SIZE <= MAX_INDEX);
    memory_consistency_assert!(i as u64 <= usize::MAX as u64);
    let a = i.leading_zeros() as usize;
    memory_consistency_assert!(a < NUM_SIZES, "{} < {}", a, NUM_SIZES);
    let b = (i & ((bucket_capacity(0) as u32 - 1) >> a)) as usize;
    memory_consistency_assert!(b < bucket_capacity(a));
    memory_consistency_assert_eq!(i, bucket_capacity(a) as u32 + b as u32);
    (a, b)
}

/// A default instance makes it easier to create sharded instances.
impl<'a, T> Default for AtomicArena<'a, T> {
    fn default() -> Self {
        Self::new()
    }
}

impl<'a, T> AtomicArena<'a, T> {
    pub const fn new() -> Self {
        AtomicArena {
            phantom_life: PhantomData,
            next_biased_index: AtomicU32::new(MIN_SIZE),
            buckets: [
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
            ],
            bucket_alloc_mutex: Mutex::new(()),
        }
    }

    /// Get pointer to bucket for slot `a`.  Normally this just fetches
    /// the pointer from `self.buckets`, but if this is the first `add`
    /// it calls `slice_for_slot_slow` to allocate it.
    #[inline]
    fn slice_for_slot(&self, a: usize) -> NonNull<MaybeUninit<T>> {
        if let Some(curr) = NonNull::new(self.buckets[a].load(Ordering::Acquire)) {
            curr
        } else {
            self.slice_for_slot_slow(a)
        }
    }

    /// Try to allocate a new bucket.  Ordinarily this will be the
    /// first `add` attempt to that bucket, but there can be a race to
    /// create a fresh bucket among multiple `add` threads.
    fn slice_for_slot_slow(&self, a: usize) -> NonNull<MaybeUninit<T>> {
        // Take the allocation mutex, and double-check that the bucket still
        // needs to be allocated.  Double-checked locking is fine because the
        // buckets are `AtomicPtr` with the unlocked read and locked write
        // as an `Acquire / Release` pair.
        let lock = self.bucket_alloc_mutex.lock();
        // Relaxed load because we know we're competing with prior lock holders now.
        if let Some(curr) = NonNull::new(self.buckets[a].load(Ordering::Relaxed)) {
            return curr;
        }
        let cap = bucket_capacity(a);
        // Allocate bucket as vector, then prise it apart since we
        // only care about capacity and pointer.  We use MaybeUninit
        // because we are tracking slot validity across all buckets
        // separately using self.size.
        // https://doc.rust-lang.org/std/vec/struct.Vec.html#guarantees
        // notes that "Vec::with_capacity(n), will produce a Vec with
        // exactly the requested capacity".
        let mut v: ManuallyDrop<Vec<MaybeUninit<T>>> = ManuallyDrop::new(Vec::with_capacity(cap));
        let len = v.len();
        let acap = v.capacity();
        let ptr = v.as_mut_ptr();
        // Ensure with_capacity has obeyed its guarantee.
        memory_consistency_assert!(acap == cap || std::mem::size_of::<T>() == 0);
        memory_consistency_assert_eq!(len, 0);
        if let Some(nn_ptr) = NonNull::new(ptr) {
            self.buckets[a].store(ptr, Ordering::Release);
            drop(lock);
            nn_ptr
        } else {
            panic!("Vec with non-0 len and null ptr!")
        }
    }

    #[inline]
    /// Number of allocated objects in the arena as of the time of call.
    pub fn len(&self) -> usize {
        (self.next_biased_index.load(Ordering::Relaxed) - MIN_SIZE) as usize
    }

    #[inline]
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Returns both `Ref` to the added value and the reference that
    /// would be returned by `get(id)`.  Equivalent to:
    /// ```ignore
    ///    let id = arena.add(element);
    ///    let r = arena.get(id);
    ///    (id, r)
    /// ```
    pub fn add_get(&self, element: T) -> (Ref<'a, T>, &T) {
        // Atomically obtain an id, thus resolving conflicts among
        // concurrent add() operations.
        let s = self.next_biased_index.fetch_add(1, Ordering::Relaxed);
        // Linearization point for add().
        assert!(s >= MIN_SIZE); // Panic on wraparound ( == overflow).
        let biased_index = NonZeroU32::new(s).unwrap(); // Succeeds after above check.
        let (a, b) = index(s);
        let e_ptr = self.slice_for_slot(a).as_ptr();
        // This is checked in index_test with monotonicity checks
        // at boundaries.  Note that s and thus (a, b) are unique,
        // so this is the first and only write to this slot.
        //
        // This is also the point where using MaybeUninit is
        // important.  This write will otherwise attempt to Drop
        // the current (uninitialized) contents of this bucket
        // entry before writing the new contents.  This can yield
        // a hard-to-debug segfault in the internals of malloc.
        let e_ptr: *mut MaybeUninit<T> = unsafe { e_ptr.add(b) };
        unsafe {
            *e_ptr = MaybeUninit::new(element);
        }
        let e: &T = unsafe { &*(*e_ptr).as_ptr() };
        (
            Ref {
                phantom: PhantomData,
                phantom_life: PhantomData,
                biased_index,
            },
            e,
        )
    }

    /// Returns `Ref` to the added value, which can safely be
    /// passed to `get`.  `self.get(self.add(t)) == &t`
    pub fn add(&self, element: T) -> Ref<'a, T> {
        let (biased_index, _) = self.add_get(element);
        biased_index
    }

    /// `get(i)` is safe if, like a pointer we might dereference, `i` is a
    /// `Ref` returned by `self.add(...)` obtained in a thread-safe way
    /// (unsafe example: load via Ordering::Relaxed).
    pub fn get(&self, r: Ref<'a, T>) -> &T {
        let i = r.biased_index.get();
        // In debug mode, bounds check and panic.  Note that this bounds check
        // won't catch all unsafe accesses, since add() increments size *before*
        // storing to the bucket.
        if cfg!(debug_assertions) {
            let l = self.next_biased_index.load(Ordering::Relaxed);
            debug_assert!(i < l, "{} < {}", i, l);
        }
        let (a, b) = index(i);
        let e_ptr = unsafe {
            // Get bucket address, but do *not* allocate a bucket.
            // Ordering::Relaxed is OK because we got a Ref in a
            // thread-safe way in get(..).
            self.buckets.get_unchecked(a).load(Ordering::Relaxed)
        };
        // Sanity check bucket.  Again, won't catch all unsafe accesses.
        memory_consistency_assert!(!e_ptr.is_null());
        unsafe {
            // Read the added element, and strip the MaybeUnit wrapper to yield a &T.
            let r: &MaybeUninit<T> = &*e_ptr.add(b);
            &*r.as_ptr()
        }
    }
}

impl<'a, T> Debug for AtomicArena<'a, T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "AtomicArena[{}]", self.len())
    }
}

impl<'a, T> Drop for AtomicArena<'a, T> {
    fn drop(&mut self) {
        // At this point all other outstanding operations on self must
        // be complete since we have a &mut reference.
        let l = self.next_biased_index.load(Ordering::Relaxed);
        if l == MIN_SIZE {
            // Nothing to do, and otherwise there's a fencepost error
            // in index(l-1) below.
            return;
        }
        let (last_a, last_b) = index(l - 1);
        for (a, bucket) in self.buckets.iter_mut().enumerate().rev() {
            // We turn each allocated bucket into a `Vec<T>` whose `capacity`
            // matches the bucket capacity and whose `len` matches the number
            // of entries in use (equal to `capacity` except for `last_a` which
            // is only using `last_b` entries).  We can then `drop` the
            // resulting `Vec`, freeing any storage held by the allocated
            // objects in addition to the storage for the bucket itself.
            if a < last_a {
                break;
            }
            let mut b_ptr = if let Some(nn) = NonNull::new(bucket.load(Ordering::Relaxed)) {
                nn
            } else {
                panic!("Null bucket pointer before length.  Shouldn't happen.")
            };
            let cap = bucket_capacity(a);
            // Every bucket after last_a is full, every bucket before it is empty.
            // last_b is the last element in last_a that has been initialized.
            let sz = if a == last_a { last_b + 1 } else { cap };
            let iv: Vec<T> = unsafe {
                // View b_ptr as a *mut T rather than a NonNull<MaybeUninit<T>>.
                let b_ptr: *mut T = (b_ptr.as_mut()).as_mut_ptr();
                // We know that the first sz elements at *b_ptr are
                // initialized, and c elements were allocated.  Build
                // a well-formed Vec<T> (stripping away MaybeUninit<>)
                // and deallocate that.  This should be at least as
                // efficient as simply calling Drop on individual
                // elements, and is vastly simpler than calling the
                // mem apis directly.
                Vec::from_raw_parts(b_ptr, sz, cap)
            };
            drop(iv);
            bucket.store(ptr::null_mut(), Ordering::Relaxed)
        }
    }
}

/// Sometimes we want to create a static `AtomicArena` with a distinguished
/// `ZERO` element pre-added at compile time.  (Example: string interning with
/// a distinguished empty string).  The `Zero<T>` struct allows us to do that
/// using a series of top-level constants.
///
/// IMPORTANT: A GIVEN INSTANCE OF `Zero<T>` CAN BE PASSED TO AT MOST ONE CALL
/// TO `AtomicArena::with_zero`!!!!  This cannot be statically enforced, which
/// is one reason there's a macro in `intern` that wraps this all up safely.
pub struct Zero<T> {
    last_bucket: [UnsafeCell<MaybeUninit<T>>; MIN_SIZE as usize],
}

impl<T> Zero<T> {
    #[inline(always)]
    pub const fn zero() -> Ref<'static, T> {
        Ref {
            phantom: PhantomData,
            phantom_life: PhantomData,
            biased_index: unsafe { NonZeroU32::new_unchecked(MIN_SIZE) },
        }
    }

    fn zero_value(&self) -> &T {
        let r: &MaybeUninit<T> = unsafe { &*self.last_bucket[0].get() };
        unsafe { &*r.as_ptr() }
    }

    pub const fn new(zero: T) -> Self {
        Zero {
            last_bucket: [
                UnsafeCell::new(MaybeUninit::new(zero)),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
                UnsafeCell::new(MaybeUninit::uninit()),
            ],
        }
    }
}

unsafe impl<T> Sync for Zero<T> {}

impl<T: Debug> Debug for Zero<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Zero({:?})", self.zero_value())
    }
}

impl<T> AtomicArena<'static, T> {
    pub const fn with_zero(z: &'static Zero<T>) -> Self {
        let p: *mut MaybeUninit<T> = z.last_bucket[0].get();
        AtomicArena {
            phantom_life: PhantomData,
            next_biased_index: AtomicU32::new(MIN_SIZE + 1),
            buckets: [
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(ptr::null_mut()),
                AtomicPtr::new(p),
            ],
            bucket_alloc_mutex: Mutex::new(()),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::thread;

    use parking_lot::Condvar;
    use parking_lot::Mutex;
    use rand::RngExt as _;

    use super::*;

    static ZERO: Zero<&str> = Zero::new("zero");
    static STRING_ARENA: AtomicArena<'static, &str> = AtomicArena::with_zero(&ZERO);

    /// For internal testing purposes we permit the unsafe synthesis of Refs.
    fn mk_ref<'a, T>(index: u32) -> Ref<'a, T> {
        Ref {
            phantom: PhantomData,
            phantom_life: PhantomData,
            biased_index: NonZeroU32::new(index + MIN_SIZE).unwrap(),
        }
    }

    #[test]
    fn empty_drop() {
        let vi: AtomicArena<'_, String> = AtomicArena::new();
        drop(vi);
    }

    #[test]
    fn sizing() {
        // A bunch of checking for off-by-one errors of various sorts
        // in the vector sizes for the telescoping array.
        for a in 0..(NUM_SIZES - 1) {
            assert_eq!(1 << (U32_BITS - 1 - a), bucket_capacity(a));
        }
        assert_eq!(MIN_SIZE as usize, bucket_capacity(NUM_SIZES - 1));
    }

    #[test]
    fn indexing() {
        let (a, b) = index(MIN_SIZE);
        assert_eq!(a, NUM_SIZES - 1);
        assert_eq!(b, 0);
        let (a, b) = index(u32::MAX);
        assert_eq!(a, 0);
        assert_eq!(b, (1 << 31) - 1);
        assert_eq!(b, bucket_capacity(0) - 1);
        // Check thresholds
        for s in (MIN_SHIFT + 1)..(U32_BITS as u32) {
            let i = 1 << s;
            let (a0, b0) = index(i - 1);
            let (a1, b1) = index(i);
            assert_eq!(a0, U32_BITS - s as usize);
            assert_eq!(
                a1,
                U32_BITS - s as usize - 1,
                "at {} -> ({}, {})",
                i,
                a1,
                b1
            );
            assert_eq!(b0, bucket_capacity(a0) - 1);
            assert_eq!(b1, 0);
        }
        // Check monotonicity.
        for i in MIN_SIZE..9 * MIN_SIZE {
            let (a0, b0) = index(i);
            let (a1, b1) = index(i + 1);
            assert!(
                (a0 == a1 && b0 < b1) || (a0 == (a1 + 1) && b1 == 0),
                "{} {} {} >= {} {} {}",
                i - 1,
                a0,
                b0,
                i,
                a1,
                b1
            );
        }
    }

    #[test]
    fn add_read() {
        let v: AtomicArena<'_, usize> = AtomicArena::new();
        assert_eq!(v.len(), 0);
        for i in 0..10_000 {
            let ii = i as u32;
            let r = v.add(i);
            assert_eq!(r.index(), ii);
            assert_eq!(v.len(), i + 1);
            assert_eq!(*v.get(r), i);
            for j in 0..=ii {
                assert_eq!(*v.get(mk_ref(j)), j as usize);
            }
        }
        // For the rest of the range, don't do the O(n^2) full check.
        for i in 10_000..10_000_000 {
            let r = v.add(i);
            assert_eq!(r.index(), i as u32);
            assert_eq!(v.len(), i + 1);
            assert_eq!(*v.get(r), i);
        }
    }

    #[test]
    fn add_read_static() {
        assert_eq!(Zero::<&str>::zero().index(), 0);
        assert_eq!(STRING_ARENA.len(), 1);
        assert_eq!(STRING_ARENA.get(Zero::<&str>::zero()), &"zero");
        for i in 1..1_000 {
            let r = STRING_ARENA.add(Box::leak(format!("{}", i).into()));
            assert_eq!(r.index(), i);
            assert_eq!(STRING_ARENA.len(), i as usize + 1);
            assert_eq!(STRING_ARENA.get(r), &format!("{}", i));
            assert_eq!(STRING_ARENA.get(Zero::<&str>::zero()), &"zero");
            for j in 1..=i {
                assert_eq!(STRING_ARENA.get(mk_ref(j)), &format!("{}", j));
            }
        }
        // For the rest of the range, don't do the O(n^2) full check.
        for i in 1_000..1_000_000 {
            let r = STRING_ARENA.add(Box::leak(format!("{}", i).into()));
            assert_eq!(r.index(), i);
            assert_eq!(STRING_ARENA.len(), i as usize + 1);
            assert_eq!(STRING_ARENA.get(r), &format!("{}", i));
            assert_eq!(STRING_ARENA.get(Zero::<&str>::zero()), &"zero");
        }
    }

    #[test]
    fn add_parallel_read() {
        const N: u32 = 1_000_000;
        let arena: Arc<AtomicArena<'_, String>> = Arc::new(AtomicArena::new());
        // Make sure we don't just run the producer or all the
        // consumers without interleaving them.
        let progress = Arc::new((Mutex::new(0u32), Condvar::new()));
        let mut consumers = Vec::new();
        let len = Arc::new(AtomicU32::new(0));
        for r in 0..10 {
            // Consumers
            let arena = arena.clone();
            let progress = progress.clone();
            let len = len.clone();
            consumers.push(thread::spawn(move || {
                const I: u32 = N * 3 / 2;
                let mut rng = rand::rng();
                let mut next_poke = 1500;
                let mut next_seek = 1000;
                let mut n_seen = 0;
                for ii in 0..I {
                    let n = len.load(Ordering::Acquire);
                    if n > 0 {
                        // First reader always checks latest completed add.
                        let i = if r == 0 {
                            n - 1
                        } else {
                            rng.random_range(0..n)
                        };
                        let s = arena.get(mk_ref(i));
                        assert_eq!(s, &format!("{}", i));
                        if r == 0 {
                            // n should trail arena.len().
                            let l = arena.len();
                            assert!(n as usize <= l);
                        }
                        n_seen += 1;
                    }
                    if ii == next_poke {
                        let (lock, cvar) = &*progress;
                        let mut l = lock.lock();
                        while *l < next_seek {
                            cvar.wait(&mut l);
                        }
                        next_poke *= 10;
                        next_seek *= 10;
                    }
                }
                assert!(n_seen > 0);
            }));
        }
        {
            // Producer in main thread.
            let mut next_poke = 1000;
            for i in 0..N {
                let r = arena.add(format!("{}", i));
                assert_eq!(r.index(), i);
                len.store(i + 1, Ordering::Release);
                if i == next_poke {
                    let (lock, cvar) = &*progress;
                    *lock.lock() = i;
                    cvar.notify_all();
                    next_poke *= 10;
                }
            }
        }
        for c in consumers {
            c.join().unwrap();
        }
    }

    #[test]
    fn parallel_add_parallel_read() {
        use std::sync::atomic::AtomicU32;
        const N: u32 = 2_000_000;
        const WRITERS: u32 = 10;
        let arena: Arc<AtomicArena<'_, usize>> = Arc::new(AtomicArena::new());
        let mut avail: Arc<Vec<AtomicU32>> = Arc::new(Vec::with_capacity(N as usize));
        Arc::get_mut(&mut avail)
            .unwrap()
            .resize_with(N as usize, || AtomicU32::new(10 * N));
        // Make sure we don't just run the producer or all the
        // consumers without interleaving them.
        let progress = Arc::new((Mutex::new(0u32), Condvar::new()));
        let mut producers = Vec::new();
        let mut consumers = Vec::new();
        for k in 0..WRITERS {
            let arena = arena.clone();
            let avail = avail.clone();
            let progress = progress.clone();
            producers.push(thread::spawn(move || {
                let mut next_poke = 10;
                for i in 0..N / WRITERS {
                    let n = i * WRITERS + k;
                    let id = arena.add(n as usize);
                    assert!(id.index() < N);
                    assert_eq!(avail[id.index() as usize].load(Ordering::Acquire), 10 * N);
                    avail[id.index() as usize].store(n, Ordering::Release);
                    if k == 0 && i == next_poke {
                        let (lock, cvar) = &*progress;
                        *lock.lock() = i;
                        next_poke *= 10;
                        cvar.notify_all();
                    }
                }
            }));
        }
        for _ in 0..10 {
            const I: u32 = N * 3 / 2;
            let arena = arena.clone();
            let avail = avail.clone();
            let progress = progress.clone();
            consumers.push(thread::spawn(move || {
                let mut rng = rand::rng();
                let mut next_poke = 150;
                let mut next_seek = 10;
                let mut n_seen = 0;
                for ii in 0..I {
                    let i = rng.random_range(0..N);
                    let expect = avail[i as usize].load(Ordering::Acquire);
                    if expect < N {
                        let s = arena.get(mk_ref(i));
                        assert_eq!(*s, expect as usize);
                        n_seen += 1;
                    }
                    if ii == next_poke {
                        let (lock, cvar) = &*progress;
                        let mut l = lock.lock();
                        while *l < next_seek {
                            cvar.wait(&mut l);
                        }
                        next_poke *= 10;
                        next_seek *= 10;
                        if next_seek >= N {
                            next_seek = 0;
                        }
                    }
                }
                assert!(n_seen > 0);
            }));
        }
        for p in producers {
            p.join().unwrap();
        }
        assert_eq!(arena.len(), N as usize);
        let mut fail: Vec<(u32, u32)> = Vec::new();
        for i in 0..N {
            let a = avail[i as usize].load(Ordering::Relaxed);
            if a >= N {
                fail.push((a, i));
            }
        }
        assert!(fail.is_empty(), "{:?}", fail);
        for c in consumers {
            c.join().unwrap();
        }
    }
}

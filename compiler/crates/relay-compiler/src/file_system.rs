/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

//! The compiler's view of the files under [`Config::root_dir`].
//!
//! Compiler inputs are read through a [`FileSystem`] injected as
//! [`Config::file_system`] rather than through `std::fs` directly, so a host
//! can supply a backend suited to its environment, such as one that queries a
//! virtual file system for listings and content hashes instead of reading
//! every file.
//!
//! Paths passed to a [`FileSystem`] are relative to its root, which is the
//! config's `root_dir`.
//!
//! [`Config::root_dir`]: crate::config::Config::root_dir
//! [`Config::file_system`]: crate::config::Config::file_system

use std::fmt::Debug;
use std::io;
use std::path::Path;
use std::path::PathBuf;

/// Read access to the files under a root directory.
///
/// Every path a method takes is relative to the file system's root, which for
/// [`Config::file_system`] is [`Config::root_dir`]. Paths are never resolved
/// against the process's working directory.
///
/// [`Config::root_dir`]: crate::config::Config::root_dir
/// [`Config::file_system`]: crate::config::Config::file_system
pub trait FileSystem: Debug + Send + Sync {
    /// Short identifier for the backend, recorded in build logs.
    fn name(&self) -> &'static str;

    /// Reads the whole file at `path`.
    ///
    /// `path` is relative to the file system's root (e.g. `src/Foo.js` for
    /// `<root_dir>/src/Foo.js`), the same root-relative form as
    /// [`File::name`](crate::File::name). It must not be absolute.
    fn read(&self, path: &Path) -> io::Result<Vec<u8>>;

    /// Reads the whole file at `path` as UTF-8.
    ///
    /// `path` is relative to the file system's root, as for
    /// [`FileSystem::read`].
    fn read_to_string(&self, path: &Path) -> io::Result<String> {
        String::from_utf8(self.read(path)?)
            .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))
    }
}

/// A [`FileSystem`] backed by `std::fs`.
#[derive(Debug)]
pub struct StdFileSystem {
    root: PathBuf,
}

impl StdFileSystem {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }
}

impl FileSystem for StdFileSystem {
    fn name(&self) -> &'static str {
        "std"
    }

    fn read(&self, path: &Path) -> io::Result<Vec<u8>> {
        std::fs::read(self.root.join(path))
    }

    fn read_to_string(&self, path: &Path) -> io::Result<String> {
        std::fs::read_to_string(self.root.join(path))
    }
}

#[cfg(all(test, any(target_os = "linux", target_os = "macos")))]
mod tests {
    use super::*;

    #[test]
    fn std_file_system_reads_relative_to_its_root() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("src")).unwrap();
        std::fs::write(dir.path().join("src/a.js"), "graphql`query A { me }`").unwrap();
        let file_system = StdFileSystem::new(dir.path().to_path_buf());

        assert_eq!(
            file_system.read_to_string(Path::new("src/a.js")).unwrap(),
            "graphql`query A { me }`",
        );
        assert_eq!(
            file_system
                .read(Path::new("src/missing.js"))
                .unwrap_err()
                .kind(),
            io::ErrorKind::NotFound,
            "a missing file should surface as NotFound",
        );
    }
}

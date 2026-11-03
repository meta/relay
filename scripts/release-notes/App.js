/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @oncall relay
 */

'use strict';

/* eslint-disable react/react-in-jsx-scope*/

const {useEffect, useState} = React;

const CATEGORIES = [
  ['BUGFIX', 3],
  ['IMPROVEMENTS', 4],
  ['DOCS', 5],
  ['NEW_API', 2],
  ['BREAKING', 1],
  ['MISC', 6],
  ['EXPERIMENTAL', 7],
  ['SKIP', 8],
];

const CATEGORIES_NAMES = {
  BUGFIX: 'Bug fixes',
  IMPROVEMENTS: 'Improvements',
  DOCS: 'Documentation Improvements',
  NEW_API: 'Added',
  BREAKING: 'Breaking Changes',
  MISC: 'Miscellaneous',
  EXPERIMENTAL: 'Experimental Changes',
  SKIP: 'Skipped in Release Notes',
};

const REPO_URL = 'https://github.com/facebook/relay';

function CommitCard({
  message,
  summary,
  author,
  selectedCategory,
  onCategoryChange,
  fullHash,
  diff,
}) {
  return (
    <div className={`commit ${selectedCategory}`} title={message}>
      <p className="summary">
        <a href={`${REPO_URL}/commit/${fullHash}`} target="_blank">
          {summary}
        </a>
      </p>
      <p className="author">
        {author}
        {diff && (
          <>
            {' '}
            <a href={`https://www.internalfb.com/diff/${diff}`} target="_blank">
              {diff}
            </a>
          </>
        )}
      </p>
      <CategoryPicker onPick={category => onCategoryChange(category)} />
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function App({commits, lastRelease}) {
  let initialState = localStorage.getItem('selectedCategories');
  if (initialState != null) {
    initialState = JSON.parse(initialState);
  } else {
    initialState = {};
  }
  const [selectedCategories, setSelectedCategories] = useState(initialState);
  useEffect(() => {
    localStorage.setItem(
      'selectedCategories',
      JSON.stringify(selectedCategories),
    );
  }, [selectedCategories]);

  return (
    <>
      <h1>Relay commits since {lastRelease}</h1>
      <div className="instructions">
        <p>
          Click on the commit card to change it's category. Possible categories
          are:{' '}
        </p>
        <Categories />
      </div>
      <div className="layout">
        <section className="commits">
          {commits.map((commit, index) => {
            return (
              <CommitCard
                key={index}
                message={commit.message}
                summary={commit.summary}
                author={commit.author}
                fullHash={commit.fullHash}
                diff={commit.diff}
                selectedCategory={selectedCategories[commit.hash]}
                onCategoryChange={category => {
                  setSelectedCategories({
                    ...selectedCategories,
                    [commit.hash]: category,
                  });
                }}
              />
            );
          })}
        </section>
        <section className="release_notes">
          <div className="copy_prompt">
            (Copy paste the below Markdown into the release notes)
          </div>
          <GeneratedReleaseNotes
            lastRelease={lastRelease}
            commits={commits}
            selectedCategories={selectedCategories}
          />
        </section>
      </div>
    </>
  );
}

function Categories() {
  return (
    <ul className="categories">
      {CATEGORIES.map(([category]) => {
        return (
          <li className={`category ${category}`} key={category}>
            {category}
          </li>
        );
      })}
    </ul>
  );
}

function CategoryPicker({onPick}) {
  return (
    <ul className="categories-picker">
      {CATEGORIES.map(([category]) => {
        return (
          <li className="category" key={category}>
            <button onClick={() => onPick(category)}>{category}</button>
          </li>
        );
      })}
    </ul>
  );
}

function GeneratedReleaseNotes({commits, selectedCategories, lastRelease}) {
  const categorizedCommits = new Map();
  const categories = Array.from(CATEGORIES);
  categories
    .sort(([, orderA], [, orderB]) => orderA - orderB)
    .forEach(([category]) => {
      categorizedCommits.set(category, []);
    });

  let hasBreakingChanges = false;
  let hasNewApi = false;

  const nonCategorizedCommits = [];

  commits.forEach(commit => {
    const commitCategory = selectedCategories[commit.hash];
    if (commitCategory != null) {
      const categoryCommits = categorizedCommits.get(commitCategory);
      if (categoryCommits != null) {
        categoryCommits.push(commit);
        if (commitCategory === 'BREAKING') {
          hasBreakingChanges = true;
        }
        if (commitCategory === 'NEW_API') {
          hasNewApi = true;
        }
      }
    } else {
      nonCategorizedCommits.push(commit);
    }
  });

  return (
    <div className="release_notes_content">
      {`# Version ${nextReleaseVersion(lastRelease, hasBreakingChanges, hasNewApi)} Release Notes\n`}
      <div>
        {Array.from(categorizedCommits).map(([category, commits]) => {
          if (commits.length) {
            return (
              <div key={category}>
                {`## ${CATEGORIES_NAMES[category]}`}
                <CommitList commits={commits} />
              </div>
            );
          } else {
            return null;
          }
        })}
        <div>
          {`## Non-categorized commits\n`}
          <CommitList commits={nonCategorizedCommits} />
        </div>
      </div>
    </div>
  );
}

function CommitList({commits}) {
  return (
    <ul>
      {commits.map(commit => {
        const summary = commit.summary.replace(/^- /, ''); // Avoid commit messages that render as indented list items.
        const link = `${REPO_URL}/commit/${commit.fullHash}`;
        return (
          <li key={commit.hash}>
            {' - '}
            {capitalize(summary)} by {commit.author} ([
            <a href={link} target="_blank">
              commit
            </a>
            ]({link}))
          </li>
        );
      })}
    </ul>
  );
}

function nextReleaseVersion(lastRelease, hasBreakingChanges, hasNewApi) {
  const [major, minor, patch] = lastRelease.replace('v', '').split('.');
  if (hasBreakingChanges) {
    return `${next(major)}.0.0`;
  } else if (hasNewApi) {
    return `${major}.${next(minor)}.0`;
  } else {
    return `${major}.${minor}.${next(patch)}`;
  }
}

function next(versionStr) {
  return parseInt(versionStr, 10) + 1;
}

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

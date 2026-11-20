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

const babelOptions = require('./scripts/getBabelOptions')({
  ast: false,
  plugins: [
    'flow-parser/babel-plugin',
    '@babel/plugin-transform-flow-strip-types',
    [
      '@babel/plugin-transform-runtime',
      {version: require('@babel/runtime/package.json').version},
    ],
    '@babel/plugin-proposal-nullish-coalescing-operator',
    '@babel/plugin-proposal-optional-catch-binding',
    '@babel/plugin-proposal-optional-chaining',
  ],
  postPlugins: [
    '@babel/plugin-transform-async-to-generator',
    '@babel/plugin-transform-modules-commonjs',
  ],
  sourceType: 'script',
});
const del = require('del');
const fs = require('fs');
const gulp = require('gulp');
const babel = require('gulp-babel');
const rename = require('gulp-rename');
const path = require('path');

const RELEASE_COMMIT_SHA = process.env.RELEASE_COMMIT_SHA;
if (RELEASE_COMMIT_SHA && RELEASE_COMMIT_SHA.length !== 40) {
  throw new Error(
    'If the RELEASE_COMMIT_SHA env variable is set, it should be set to the ' +
      '40 character git commit hash.',
  );
}

// Builds of the `main` branch are published as `0.0.1-main.N`, where N is the
// number of commits on `main`. This gives every commit a monotonically
// increasing version, so consumers can depend on "this commit or newer" with a
// range like `^0.0.1-main.N`.
//
// * It is a prerelease, so it never matches ranges targeting stable releases,
//   and tools (e.g. the VS Code extension) still recognize it as a main build.
// * The `0.0.1` base sorts above the legacy `0.0.0-main-<sha>` versions.
const RELEASE_COMMIT_NUMBER = process.env.RELEASE_COMMIT_NUMBER;
if (RELEASE_COMMIT_NUMBER && !/^[1-9][0-9]*$/.test(RELEASE_COMMIT_NUMBER)) {
  throw new Error(
    'If the RELEASE_COMMIT_NUMBER env variable is set, it should be set to ' +
      'the number of commits on the main branch (`git rev-list --count HEAD`).',
  );
}

const IS_MAIN_RELEASE = Boolean(RELEASE_COMMIT_SHA && RELEASE_COMMIT_NUMBER);

const VERSION = IS_MAIN_RELEASE
  ? `0.0.1-main.${RELEASE_COMMIT_NUMBER}`
  : process.env.npm_package_version;

const PRODUCTION_HEADER = `/**
 * Relay v${VERSION}${IS_MAIN_RELEASE ? ` (${RELEASE_COMMIT_SHA})` : ''}
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
`;

// Paths from package-root
const PACKAGES = 'packages';
const DIST = 'dist';

// Globs for paths in PACKAGES
const INCLUDE_GLOBS = [
  '**/*.js',
  '!**/__tests__/**',
  '!**/__flowtests__/**',
  '!**/__mocks__/**',
  '!**/node_modules/**',
];

const builds = [
  {
    package: 'babel-plugin-relay',
    exports: {
      index: 'BabelPluginRelay.js',
      macro: 'BabelPluginRelay.macro.js',
    },
  },
  {
    package: 'react-relay',
    exports: {
      index: 'index.js',
      hooks: 'hooks.js',
      legacy: 'legacy.js',
      ReactRelayContext: 'ReactRelayContext.js',
      rsc_EXPERIMENTAL: 'rsc_EXPERIMENTAL.js',
      'rsc-client_EXPERIMENTAL': 'rsc-client_EXPERIMENTAL.js',
    },
  },
  {
    package: 'relay-runtime',
    exports: {
      index: 'index.js',
      experimental: 'experimental.js',
    },
  },
  {
    package: 'relay-test-utils',
    exports: {
      index: 'index.js',
    },
  },
  {
    package: 'relay-test-utils-internal',
    exports: {
      index: 'index.js',
    },
  },
];

const modules = gulp.parallel(
  ...builds.map(
    build =>
      function modulesTask() {
        return gulp
          .src(INCLUDE_GLOBS, {
            cwd: path.join(PACKAGES, build.package),
          })
          .pipe(babel(babelOptions))
          .pipe(gulp.dest(path.join(DIST, build.package, 'lib')));
      },
  ),
);

const flowDefs = gulp.parallel(
  ...builds.map(
    build =>
      function modulesTask() {
        return gulp
          .src(['**/*.js', '!**/__tests__/**/*.js', '!**/__mocks__/**/*.js'], {
            cwd: PACKAGES + '/' + build.package,
          })
          .pipe(rename({extname: '.js.flow'}))
          .pipe(gulp.dest(path.join(DIST, build.package)));
      },
  ),
);

const typeDefs = gulp.parallel(
  ...builds.map(
    build =>
      function typeDefsTask() {
        return gulp
          .src(
            ['**/*.d.ts', '!**/__tests__/**/*.d.ts', '!**/__mocks__/**/*.d.ts'],
            {
              cwd: PACKAGES + '/' + build.package,
            },
          )
          .pipe(gulp.dest(path.join(DIST, build.package)));
      },
  ),
);

const copyFilesTasks = [];
builds.forEach(build => {
  copyFilesTasks.push(
    function copyLicense() {
      return gulp
        .src(['LICENSE'])
        .pipe(gulp.dest(path.join(DIST, build.package)));
    },
    function copyReadmeFile() {
      return gulp
        .src(['README.md'], {
          cwd: path.join(PACKAGES, build.package),
        })
        .pipe(gulp.dest(path.join(DIST, build.package)));
    },
    function copyTestschema() {
      return gulp
        .src(['*.graphql'], {
          cwd: path.join(PACKAGES, build.package),
        })
        .pipe(gulp.dest(path.join(DIST, build.package, 'lib')));
    },
    function copyPackageJSON() {
      return gulp
        .src(['package.json'], {
          cwd: path.join(PACKAGES, build.package),
        })
        .pipe(gulp.dest(path.join(DIST, build.package)));
    },
  );
});
const copyFiles = gulp.parallel(copyFilesTasks);

const exportsFiles = gulp.series(
  copyFiles,
  gulp.parallel(flowDefs, typeDefs),
  modules,
  gulp.parallel(
    ...builds.map(
      build =>
        function exportsFilesTask(done) {
          Object.keys(build.exports).map(exportName =>
            fs.writeFileSync(
              path.join(DIST, build.package, exportName + '.js'),
              PRODUCTION_HEADER +
                `\nmodule.exports = require('./lib/${build.exports[exportName]}');\n`,
            ),
          );
          done();
        },
    ),
  ),
);

const clean = () => del(DIST);
function copyDocs() {
  return gulp
    .src(['**/*.mdx', '!FbFakeContent.mdx'], {
      cwd: 'website/docs',
    })
    .pipe(gulp.dest(path.join(DIST, 'relay-runtime', 'llm-docs')));
}

const dist = gulp.series(exportsFiles, copyDocs);
const watch = gulp.series(dist, () =>
  gulp.watch(INCLUDE_GLOBS, {cwd: PACKAGES}, dist),
);

const relayCompiler = gulp.parallel(
  function copyLicense() {
    return gulp
      .src(['LICENSE'])
      .pipe(gulp.dest(path.join(DIST, 'relay-compiler')));
  },
  function copyGraphQLExtensions() {
    return gulp
      .src(
        path.join(
          '.',
          'compiler',
          'crates',
          'relay-schema',
          'src',
          'relay-extensions.graphql',
        ),
      )
      .pipe(gulp.dest(path.join(DIST, 'relay-compiler')));
  },
  function copyPackageFiles() {
    return gulp
      .src(['README.md', 'package.json', 'cli.js', 'index.js'], {
        cwd: path.join(PACKAGES, 'relay-compiler'),
      })
      .pipe(gulp.dest(path.join(DIST, 'relay-compiler')));
  },
  function copyCompilerConfigSchema() {
    return gulp
      .src(['relay-compiler-config-schema.json'], {
        cwd: path.join('compiler/crates/relay-compiler'),
      })
      .pipe(gulp.dest(path.join(DIST, 'relay-compiler')));
  },
  function copyCompilerBins() {
    return gulp
      .src('**', {
        cwd: path.join('artifacts'),
      })
      .pipe(gulp.dest(path.join(DIST, 'relay-compiler')));
  },
);

/**
 * Updates the package.json files `/dist/` with a version to release to npm under
 * the main tag.
 */
const setMainVersion = async () => {
  if (!IS_MAIN_RELEASE) {
    throw new Error(
      'Expected the RELEASE_COMMIT_SHA and RELEASE_COMMIT_NUMBER env ' +
        'variables to be set.',
    );
  }
  const packages = builds.map(build => build.package);
  packages.push('relay-compiler');
  packages.forEach(pkg => {
    const pkgJsonPath = path.join('.', 'dist', pkg, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    packageJson.version = VERSION;
    for (const depKind of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
    ]) {
      const deps = packageJson[depKind];
      for (const dep in deps) {
        if (packages.includes(dep)) {
          deps[dep] = VERSION;
        }
      }
    }
    fs.writeFileSync(
      pkgJsonPath,
      JSON.stringify(packageJson, null, 2) + '\n',
      'utf8',
    );
  });
};

async function setCompilerMainVersion() {
  if (!IS_MAIN_RELEASE) {
    throw new Error(
      'Expected the RELEASE_COMMIT_SHA and RELEASE_COMMIT_NUMBER env ' +
        'variables to be set.',
    );
  }
  // The `relay` binary (and so `relay-compiler --version`) gets its version
  // from the relay-bin crate's CARGO_PKG_VERSION.
  const compilerCargoFile = path.join(
    '.',
    'compiler',
    'crates',
    'relay-bin',
    'Cargo.toml',
  );
  const cargo = fs.readFileSync(compilerCargoFile, 'utf8');
  // Replace the `version` of the `[package]` section, whatever it currently is.
  const packageVersionRegex = /^(\[package\][^[]*?^version = )"[^"]*"/m;
  if (!packageVersionRegex.test(cargo)) {
    throw new Error(
      `Could not find the package version in ${compilerCargoFile}`,
    );
  }
  const updatedCargo = cargo.replace(packageVersionRegex, `$1"${VERSION}"`);
  fs.writeFileSync(compilerCargoFile, updatedCargo, 'utf8');
}

const cleanbuild = gulp.series(clean, dist);

exports.clean = clean;
exports.dist = dist;
exports.watch = watch;
exports.mainrelease = gulp.series(cleanbuild, relayCompiler, setMainVersion);
exports.release = gulp.series(cleanbuild, relayCompiler);
exports.cleanbuild = cleanbuild;
exports.default = cleanbuild;
exports.setCompilerMainVersion = setCompilerMainVersion;

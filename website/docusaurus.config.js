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

const versions = require('./versions.json');
const {
  fbContent,
  isInternal,
} = require('docusaurus-plugin-internaldocs-fb/internal');
const {themes: prismThemes} = require('prism-react-renderer');

module.exports = {
  title: 'Relay',
  tagline: 'The GraphQL client that scales with you.',
  url: 'https://relay.dev',
  baseUrl: '/',
  trailingSlash: true,
  organizationName: 'facebook',
  projectName: 'relay',
  scripts: [],
  favicon: 'img/favicon.png',
  future: {
    experimental_faster: true,
    v4: {
      removeLegacyPostBuildHeadAttribute: true,
    },
  },
  customFields: {
    users: [
      {
        caption: '1stdibs',
        image: '/img/logos/1stdibs.png',
        infoLink: 'https://www.1stdibs.com/',
        pinned: true,
        description: 'Used on 1stdibs.com',
      },
      {
        caption: 'Artsy',
        image: '/img/logos/artsy.png',
        infoLink: 'http://artsy.github.io/open-source/',
        pinned: true,
        description: 'Used on artsy.net, and the React Native iOS app, Eigen.',
      },
      {
        caption: 'Woovi',
        image: '/img/logos/woovi.png',
        infoLink: 'http://woovi.com/',
        pinned: true,
        description: 'Used on woovi.com',
      },
      {
        caption: 'Facebook',
        image: '/img/logos/facebook.png',
        infoLink: 'https://code.facebook.com',
        pinned: true,
        description:
          'Used on facebook.com, and in the React Native mobile app.',
      },
      {
        caption: 'Oculus',
        image: '/img/logos/oculus.png',
        infoLink: 'https://www.oculus.com/',
        pinned: true,
        description:
          'Used on oculus.com, Oculus Home in VR, and the React Native Oculus companion app.',
      },
      {
        caption: 'Lattice',
        image: '/img/logos/lattice_logo_full_color.png',
        infoLink: 'https://lattice.com/',
        pinned: false,
      },
      {
        caption: 'Cirrus CI',
        image: '/img/logos/cirrus.png',
        infoLink: 'https://cirrus-ci.com/',
        pinned: false,
      },
      {
        caption: 'Contra',
        image: '/img/logos/contra.png',
        infoLink: 'https://contra.com',
        pinned: false,
      },
      {
        caption: 'Friday',
        image: '/img/logos/friday.png',
        infoLink: 'https://friday.work/',
        pinned: false,
      },
      {
        caption: 'Flexport',
        image: '/img/logos/flexport.png',
        infoLink: 'https://flexport.com',
        pinned: false,
      },
      {
        caption: 'Parabol',
        image: '/img/logos/parabol.png',
        infoLink: 'https://www.parabol.co/',
        pinned: false,
      },
      {
        caption: 'itDAGENE',
        image: '/img/logos/itdagene.png',
        infoLink: 'https://github.com/itdagene-ntnu/itdagene-webapp',
        pinned: false,
      },
      {
        caption: 'Kiwi.com',
        image: '/img/logos/kiwicom.png',
        infoLink: 'https://www.kiwi.com/',
        pinned: false,
      },
      {
        caption: 'Jusbrasil',
        image: '/img/logos/jusbrasil.png',
        infoLink: 'https://github.com/jusbrasil',
        pinned: false,
      },
      {
        caption: 'Up',
        image: '/img/logos/up.png',
        infoLink: 'https://up.com.au/',
        pinned: false,
      },
      {
        caption: 'AutoGuru',
        image: '/img/logos/autoguru.png',
        infoLink: 'https://www.autoguru.com.au/',
        pinned: true,
        description: 'Used at autoguru.com.au, and affiliates',
      },
      {
        caption: 'M1 Finance',
        image: '/img/logos/m1finance.png',
        infoLink: 'https://www.m1finance.com/',
        pinned: false,
      },
      {
        caption: 'Bumped',
        image: '/img/logos/bumped.png',
        infoLink: 'https://bumped.com/',
        pinned: false,
      },
      {
        caption: 'Clubhouse',
        image: '/img/logos/clubhouse.png',
        infoLink: 'https://clubhouse.io/',
        pinned: false,
      },
      {
        caption: 'Habilelabs',
        image: '/img/logos/habilelabs.png',
        infoLink: 'http://www.habilelabs.io/',
        pinned: false,
      },
      {
        caption: 'Butterfly Network',
        image: '/img/logos/butterfly.png',
        infoLink: 'https://www.butterflynetwork.com/',
        pinned: false,
      },
      {
        caption: 'Mindworking',
        image: '/img/logos/mindworking.png',
        infoLink: 'https://mindworking.eu/',
        pinned: false,
      },
      {
        caption: 'domonda',
        image: '/img/logos/domonda.png',
        infoLink: 'https://domonda.com/',
        pinned: false,
      },
      {
        caption: 'SwissDev JavaScript Jobs',
        image: '/img/logos/swissdev-javascript-jobs.png',
        infoLink: 'https://swissdevjobs.ch/jobs/JavaScript/All',
        pinned: false,
      },
      {
        caption: 'Atlassian',
        image: '/img/logos/vertical-logo-gradient-blue-atlassian.svg',
        infoLink: 'https://www.atlassian.com/',
        pinned: false,
      },
      {
        caption: 'Réa',
        image: '/img/logos/rea.png',
        infoLink: 'https://www.rea-app.fr/',
        pinned: false,
      },
      {
        caption: 'Steep Wellness',
        image: '/img/logos/steep.png',
        infoLink: 'https://steepapp.com',
        pinned: false,
      },
      {
        caption: 'GigSmart',
        image: '/img/logos/gigsmart.png',
        infoLink: 'https://gigsmart.com',
        pinned: false,
      },
    ],
  },
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'throw',
  onDuplicateRoutes: 'throw',
  presets: [
    [
      require.resolve('docusaurus-plugin-internaldocs-fb/docusaurus-preset'),
      {
        docs: {
          showLastUpdateAuthor: false,
          showLastUpdateTime: false,
          editUrl: fbContent({
            internal:
              'https://www.internalfb.com/intern/diffusion/FBS/browse/master/xplat/js/RKJSModules/Libraries/Relay/oss/__github__/website/',
            external: 'https://github.com/facebook/relay/tree/main/website',
          }),

          path: './docs/',

          sidebarPath: require.resolve('./sidebars.js'),
          lastVersion: fbContent({
            internal: 'current',
            external: versions[0],
          }),
          onlyIncludeVersions: fbContent({
            internal: ['current'],
            external: [
              'current',
              ...versions.filter(
                version => version !== 'experimental' && version !== 'classic',
              ),
            ],
          }),
          versions: {
            current: {
              label: 'Next 🚧',
            },
          },
        },
        blog: {},
        theme: {
          customCss: [
            './src/css/docusaurus-1.css',
            './src/css/prism.css',
            './src/css/customTheme.css',
            './src/css/custom.css',
            './src/css/jsonSchema.css',
          ],
        },
        gtag: {
          trackingID: 'G-DCSC7FDGL5',
        },
        googleAnalytics: {
          trackingID: 'G-DCSC7FDGL5',
        },
      },
    ],
  ],
  plugins: [
    require.resolve('./plugins/webpack-alias'),
    [
      '@docusaurus/plugin-client-redirects',
      {
        createRedirects: function (toPath) {
          if (toPath.startsWith('/docs/')) {
            const docPath = toPath.substring(6);
            const fromPaths = ['/docs/en/' + docPath];
            if (isInternal()) {
              fromPaths.push('/docs/next/' + docPath);
              fromPaths.push('/docs/en/next/' + docPath);
            }
            return fromPaths;
          }
        },
        redirects: [
          {
            to: '/docs/',
            from: [
              '/docs/en/introduction-to-relay',
              '/docs/introduction-to-relay',
            ],
          },
          {
            // Update on next versioned docs release
            // to: '/docs/getting-started/quick-start',
            to: '/docs/',
            from: ['/docs/en/quick-start-guide', '/docs/quick-start-guide'],
          },
          {
            // Update on next versioned docs release
            // to: '/docs/getting-started/quick-start',
            to: '/docs/',
            from: [
              '/docs/en/experimental/step-by-step',
              '/docs/experimental/step-by-step',
            ],
          },
          {
            to: '/docs/guides/testing-relay-with-preloaded-queries/',
            from: ['/docs/guides/testing-relay-with-preloaded-components/'],
          },
          {
            to: '/docs/guides/compiler/',
            from: [
              '/docs/en/graphql-in-relay.html',
              '/docs/en/graphql-in-relay',
              '/docs/graphql-in-relay.html',
              '/docs/graphql-in-relay',
            ],
          },
          {
            to: '/docs/principles-and-architecture/thinking-in-graphql/',
            from: [
              '/docs/en/thinking-in-graphql.html',
              '/docs/en/thinking-in-graphql',
              '/docs/thinking-in-graphql.html',
              '/docs/thinking-in-graphql',
            ],
          },
          {
            to: '/docs/principles-and-architecture/thinking-in-relay/',
            from: [
              '/docs/en/thinking-in-relay.html',
              '/docs/en/thinking-in-relay',
              '/docs/thinking-in-relay.html',
              '/docs/thinking-in-relay',
            ],
          },
          {
            to: '/docs/guides/type-emission/',
            from: ['/docs/en/type-emission', '/docs/type-emission'],
          },
          {
            to: '/docs/guides/client-schema-extensions/',
            from: [
              '/docs/en/local-state-management',
              '/docs/en/next/local-state-management',
              '/docs/local-state-management',
              '/docs/next/local-state-management',
            ],
          },
          {
            to: '/docs/api-reference/store/',
            from: [
              '/docs/en/relay-store',
              '/docs/en/next/relay-store',
              '/docs/relay-store',
              '/docs/next/relay-store',
            ],
          },
          {
            to: '/docs/guided-tour/updating-data/graphql-mutations/',
            from: [
              '/docs/en/mutations',
              '/docs/en/next/mutations',
              '/docs/mutations',
              '/docs/next/mutations',
            ],
          },
          {
            to: '/compiler-explorer',
            from: ['/compiler-playground'],
          },
          {
            to: '/docs/getting-started/quick-start/',
            from: ['/docs/guided-tour/'],
          },
        ],
      },
    ],
  ],
  themeConfig: {
    navbar: {
      title: 'Relay',
      style: 'primary',
      hideOnScroll: false,
      items: [
        {
          to: 'docs/',
          label: 'Docs',
          position: 'left',
        },
        {
          to: 'blog/',
          label: 'Blog',
          position: 'left',
        },
        {
          to: '/help',
          label: 'Help',
          position: 'left',
        },
        {
          href: 'https://github.com/facebook/relay',
          label: 'GitHub',
          position: 'left',
        },
        fbContent({
          internal: null,
          external: {
            type: 'docsVersionDropdown',
            position: 'right',
            dropdownActiveClassDisabled: true,
            dropdownItemsAfter: [
              {
                to: '/versions',
                label: 'All versions',
              },
            ],
          },
        }),
      ].filter(Boolean),
    },
    image: 'img/relay.png',
    footer: {
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Introduction',
              href: '/docs',
              target: '_self',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'User Showcase',
              href: '/users',
              target: '_self',
            },
          ],
        },
        {
          title: 'Legal',
          items: [
            {
              label: 'Privacy',
              href: 'https://opensource.facebook.com/legal/privacy/',
            },
            {
              label: 'Terms',
              href: 'https://opensource.facebook.com/legal/terms/',
            },
            {
              label: 'Data Policy',
              href: 'https://opensource.facebook.com/legal/data-policy/',
            },
            {
              label: 'Cookie Policy',
              href: 'https://opensource.facebook.com/legal/cookie-policy/',
            },
          ],
        },
      ],
      logo: {
        src: 'img/relay.svg',
      },
      copyright: `Copyright © ${new Date().getFullYear()} Meta Platforms, Inc. Built with Docusaurus.`,
    },
    prism: {
      theme: require('./prismTheme'),
      darkTheme: prismThemes.dracula,
      defaultLanguage: 'javascript',
      magicComments: [
        {
          className: 'code-change',
          line: 'change-line',
          block: {start: 'change', end: 'end-change'},
        },
        {
          className: 'color1',
          line: 'color1',
        },
        {
          className: 'color2',
          line: 'color2',
        },
        {
          className: 'color3',
          line: 'color3',
        },
        {
          className: 'color4',
          line: 'color4',
        },
        {
          className: 'color5',
          line: 'color5',
        },
      ],
    },
    algolia: {
      appId: 'UBPJPW35NS',
      apiKey: '26e12c1c268d99b20a16f365f8593df9',
      indexName: 'relay',
      contextualSearch: true,
    },
  },
};

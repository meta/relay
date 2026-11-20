/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 * @oncall react_native
 */

// From: https://github.com/chalk/chalk/blob/main/source/index.d.ts

declare module 'chalk' {
  declare type TemplateStringsArray = ReadonlyArray<string>;

  declare type Level = Values<{
    None: 0,
    Basic: 1,
    Ansi256: 2,
    TrueColor: 3,
    ...
  }>;

  declare type ChalkOptions = {
    level?: Level,
  };

  declare type ColorSupport = {
    level: Level,
    hasBasic: boolean,
    has256: boolean,
    has16m: boolean,
  };

  declare class Instance implements Chalk {
    constructor(options?: ChalkOptions): this;

    (...text: string[]): string;
    (text: TemplateStringsArray, ...placeholders: string[]): string;
    Instance: typeof Instance;
    level: Level;
    rgb(r: number, g: number, b: number): Chalk;
    hsl(h: number, s: number, l: number): Chalk;
    hsv(h: number, s: number, v: number): Chalk;
    hwb(h: number, w: number, b: number): Chalk;
    bgHex(color: string): Chalk;
    bgKeyword(color: string): Chalk;
    bgRgb(r: number, g: number, b: number): Chalk;
    bgHsl(h: number, s: number, l: number): Chalk;
    bgHsv(h: number, s: number, v: number): Chalk;
    bgHwb(h: number, w: number, b: number): Chalk;
    hex(color: string): Chalk;
    keyword(color: string): Chalk;

    readonly reset: Chalk;
    readonly bold: Chalk;
    readonly dim: Chalk;
    readonly italic: Chalk;
    readonly underline: Chalk;
    readonly inverse: Chalk;
    readonly hidden: Chalk;
    readonly strikethrough: Chalk;

    readonly visible: Chalk;

    readonly black: Chalk;
    readonly red: Chalk;
    readonly green: Chalk;
    readonly yellow: Chalk;
    readonly blue: Chalk;
    readonly magenta: Chalk;
    readonly cyan: Chalk;
    readonly white: Chalk;
    readonly gray: Chalk;
    readonly grey: Chalk;
    readonly blackBright: Chalk;
    readonly redBright: Chalk;
    readonly greenBright: Chalk;
    readonly yellowBright: Chalk;
    readonly blueBright: Chalk;
    readonly magentaBright: Chalk;
    readonly cyanBright: Chalk;
    readonly whiteBright: Chalk;

    readonly bgBlack: Chalk;
    readonly bgRed: Chalk;
    readonly bgGreen: Chalk;
    readonly bgYellow: Chalk;
    readonly bgBlue: Chalk;
    readonly bgMagenta: Chalk;
    readonly bgCyan: Chalk;
    readonly bgWhite: Chalk;
    readonly bgBlackBright: Chalk;
    readonly bgRedBright: Chalk;
    readonly bgGreenBright: Chalk;
    readonly bgYellowBright: Chalk;
    readonly bgBlueBright: Chalk;
    readonly bgMagentaBright: Chalk;
    readonly bgCyanBright: Chalk;
    readonly bgWhiteBright: Chalk;

    supportsColor: ColorSupport;
  }

  declare interface Chalk {
    (...text: string[]): string;
    (text: TemplateStringsArray, ...placeholders: string[]): string;
    Instance: typeof Instance;
    level: Level;
    rgb(r: number, g: number, b: number): Chalk;
    hsl(h: number, s: number, l: number): Chalk;
    hsv(h: number, s: number, v: number): Chalk;
    hwb(h: number, w: number, b: number): Chalk;
    bgHex(color: string): Chalk;
    bgKeyword(color: string): Chalk;
    bgRgb(r: number, g: number, b: number): Chalk;
    bgHsl(h: number, s: number, l: number): Chalk;
    bgHsv(h: number, s: number, v: number): Chalk;
    bgHwb(h: number, w: number, b: number): Chalk;
    hex(color: string): Chalk;
    keyword(color: string): Chalk;

    readonly reset: Chalk;
    readonly bold: Chalk;
    readonly dim: Chalk;
    readonly italic: Chalk;
    readonly underline: Chalk;
    readonly inverse: Chalk;
    readonly hidden: Chalk;
    readonly strikethrough: Chalk;

    readonly visible: Chalk;

    readonly black: Chalk;
    readonly red: Chalk;
    readonly green: Chalk;
    readonly yellow: Chalk;
    readonly blue: Chalk;
    readonly magenta: Chalk;
    readonly cyan: Chalk;
    readonly white: Chalk;
    readonly gray: Chalk;
    readonly grey: Chalk;
    readonly blackBright: Chalk;
    readonly redBright: Chalk;
    readonly greenBright: Chalk;
    readonly yellowBright: Chalk;
    readonly blueBright: Chalk;
    readonly magentaBright: Chalk;
    readonly cyanBright: Chalk;
    readonly whiteBright: Chalk;

    readonly bgBlack: Chalk;
    readonly bgRed: Chalk;
    readonly bgGreen: Chalk;
    readonly bgYellow: Chalk;
    readonly bgBlue: Chalk;
    readonly bgMagenta: Chalk;
    readonly bgCyan: Chalk;
    readonly bgWhite: Chalk;
    readonly bgBlackBright: Chalk;
    readonly bgRedBright: Chalk;
    readonly bgGreenBright: Chalk;
    readonly bgYellowBright: Chalk;
    readonly bgBlueBright: Chalk;
    readonly bgMagentaBright: Chalk;
    readonly bgCyanBright: Chalk;
    readonly bgWhiteBright: Chalk;

    supportsColor: ColorSupport;
  }

  declare module.exports: Chalk;
}

import type {BuildResult, ParsedToken, ParsedTypographyToken, Plugin, ResolvedConfig} from '@cobalt-ui/core';
import pluginCSS, {
  type Options as PluginCSSOptions,
  transformColor,
  transformCubicBezier,
  transformDimension,
  transformDuration,
  transformFontFamily,
  transformFontWeight,
  transformLink,
  transformNumber,
  transformStrokeStyle,
  varRef,
} from '@cobalt-ui/plugin-css';
import {indent, isAlias} from '@cobalt-ui/utils';
import {encode, formatFontFamilyNames} from './util.js';

const CAMELCASE_RE = /([^A-Z])([A-Z])/g;
const VAR_TOKENS = '__token-values';
const VAR_TYPOGRAPHY = '__token-typography-mixins';
const VAR_ERROR = '__cobalt-error';
const TRAILING_WS_RE = /\s+$/gm;
const DEPENDENCIES = ['sass:list', 'sass:map'];

export interface Options {
  /** output file (default: "./tokens/index.sass") */
  filename?: string;
  /** */
  pluginCSS?: PluginCSSOptions;
  /** use indented syntax (.sass)? (default: false) */
  indentedSyntax?: boolean;
  /** embed files in CSS? */
  embedFiles?: boolean;
  /** handle different token types */
  transform?: (token: ParsedToken, mode?: string) => string;
  /** transform color */
  colorFormat?: NonNullable<PluginCSSOptions['colorFormat']>;
}

export default function pluginSass(options?: Options): Plugin {
  let config: ResolvedConfig;
  let ext = options?.indentedSyntax ? '.sass' : '.scss';
  let filename = `${options?.filename?.replace(/(\.(sass|scss))?$/, '') || 'index'}${ext}`;

  const colorFormat = options?.colorFormat ?? 'hex';

  const cssPlugin = options?.pluginCSS ? pluginCSS(options.pluginCSS) : undefined;

  const semi = options?.indentedSyntax ? '' : ';';
  const cbOpen = options?.indentedSyntax ? '' : ' {';
  const cbClose = options?.indentedSyntax ? '' : '} ';

  const TOKEN_FN = `@function token($tokenName, $modeName: default)${cbOpen}
  @if map.has-key($${VAR_TOKENS}, $tokenName) == false${cbOpen}
    @error "No token named \\"#{$tokenName}\\""${semi}
  ${cbClose}
  $_token: map.get($${VAR_TOKENS}, $tokenName)${semi}
  @if map.has-key($_token, "__cobalt-error")${cbOpen}
    @error map.get($_token, "__cobalt-error")${semi}
  ${cbClose}
  @if map.has-key($_token, $modeName) {
    @return map.get($_token, $modeName)${semi}
  ${cbClose}@else${cbOpen}
    @return map.get($_token, default)${semi}
  ${cbClose}
${cbClose}`
    .trim()
    .replace(TRAILING_WS_RE, '');

  const LIST_MODES_FN = `@function listModes($tokenName)${cbOpen}
  @if map.has-key($${VAR_TOKENS}, $tokenName) == false${cbOpen}
    @error "No token named \\"#{$tokenName}\\""${semi}
  ${cbClose}
  $_modes: ();
  @each $k in map.get($${VAR_TOKENS}, $tokenName)${cbOpen}
    @if $k != "default"${cbOpen}
      $_modes: list.append($_modes, $k);
    ${cbClose}
  ${cbClose}
  @return $_modes;
${cbClose}`
    .trim()
    .replace(TRAILING_WS_RE, '');

  const TYPOGRAPHY_MIXIN = `@mixin typography($tokenName, $modeName: default)${cbOpen}
  @if map.has-key($${VAR_TYPOGRAPHY}, $tokenName) == false${cbOpen}
    @error "No typography mixin named \\"#{$tokenName}\\""${semi}
  ${cbClose}
  $_mixin: map.get($${VAR_TYPOGRAPHY}, $tokenName)${semi}
  $_properties: map.get($_mixin, default)${semi}
  @if map.has-key($_mixin, $modeName)${cbOpen}
    $_properties: map.get($_mixin, $modeName)${semi}
  ${cbClose}
  @each $_property, $_value in $_properties${cbOpen}
    #{$_property}: #{$_value}${semi}
  ${cbClose}
${cbClose}`
    .trim()
    .replace(TRAILING_WS_RE, '');

  return {
    name: '@cobalt-ui/plugin-sass',
    config(c): void {
      config = c;
      if (cssPlugin && typeof cssPlugin.config === 'function') cssPlugin.config(c);
    },
    async build({tokens, metadata, rawSchema}): Promise<BuildResult[]> {
      let output: string[] = [];
      const typographyTokens: ParsedTypographyToken[] = [];
      const customTransform = typeof options?.transform === 'function' ? options.transform : undefined;
      const prefix = options?.pluginCSS?.prefix || '';

      // metadata (SassDoc)
      output.push('////');
      output.push(`/// ${metadata.name || 'Design Tokens'}`);
      output.push('/// Autogenerated from tokens.json.');
      output.push('/// DO NOT EDIT!');
      output.push('////');
      output.push('');

      // basic tokens
      output.push(...DEPENDENCIES.map((name) => `@use "${name}"${semi}`));
      output.push('');
      output.push(indent(`$${VAR_TOKENS}: (`, 0));
      for (const token of tokens) {
        // special case: typography tokens needs @mixins, so bypass normal route
        if (token.$type === 'typography') {
          typographyTokens.push(token);
          output.push(indent(`"${token.id}": (`, 1));
          output.push(indent(`"${VAR_ERROR}": "This is a typography mixin. Use \`@include typography(\\"${token.id}\\")\` instead.",`, 2));
          output.push(indent(`),`, 1));
          continue;
        }

        output.push(indent(`"${token.id}": (`, 1));

        // default value
        let value = cssPlugin ? varRef(token.id, {prefix}) : (customTransform && customTransform(token)) || defaultTransformer(token, {colorFormat});
        if (token.$type === 'link' && options?.embedFiles) value = encode(value as string, config.outDir);
        output.push(indent(`default: (${value}),`, 2));

        // modes
        for (const modeName of Object.keys((token.$extensions && token.$extensions.mode) || {})) {
          let modeValue = cssPlugin ? varRef(token.id, {prefix}) : (customTransform && customTransform(token, modeName)) || defaultTransformer(token, {colorFormat, mode: modeName});
          if (token.$type === 'link' && options?.embedFiles) modeValue = encode(modeValue as string, config.outDir);
          output.push(indent(`"${modeName}": (${modeValue}),`, 2));
        }
        output.push(indent('),', 1));
      }
      output.push(`)${semi}`);
      output.push('');

      // typography tokens
      output.push(`$${VAR_TYPOGRAPHY}: (`);
      for (const token of typographyTokens) {
        output.push(indent(`"${token.id}": (`, 1));
        output.push(indent(`default: (`, 2));
        const defaultProperties = Object.entries(token.$value); // legacy: support camelCase properties
        defaultProperties.sort(([a], [b]) => a.localeCompare(b));
        for (const [k, value] of defaultProperties) {
          const property = k.replace(CAMELCASE_RE, '$1-$2').toLowerCase();
          if (cssPlugin) {
            output.push(indent(`"${property}": (${varRef(token.id, {prefix, suffix: property})}),`, 3));
          } else {
            output.push(indent(`"${property}": (${Array.isArray(value) ? formatFontFamilyNames(value) : value}),`, 3));
          }
        }
        output.push(indent(`),`, 2));
        for (const [mode, modeValue] of Object.entries((token.$extensions && token.$extensions.mode) || {})) {
          output.push(indent(`"${mode}": (`, 2));
          const modeProperties = Object.entries(modeValue);
          modeProperties.sort(([a], [b]) => a.localeCompare(b));
          for (const [k, value] of modeProperties) {
            const property = k.replace(CAMELCASE_RE, '$1-$2').toLowerCase();
            output.push(indent(`"${property}": (${Array.isArray(value) ? formatFontFamilyNames(value) : value}),`, 3));
          }
          output.push(indent(`),`, 2));
        }
        output.push(indent(`),`, 1));
      }
      output.push(`)${semi}`);
      output.push('');

      // utilities
      output.push(TOKEN_FN);
      output.push('');
      output.push(LIST_MODES_FN);
      output.push('');
      output.push(TYPOGRAPHY_MIXIN);
      output.push('');

      return [
        {
          filename,
          contents: output.join('\n'),
        },
        // build pluginCSS (if used)
        ...((cssPlugin && (await cssPlugin.build({tokens, metadata, rawSchema}))) || []),
      ];
    },
  };
}

export function defaultTransformer(token: ParsedToken, {colorFormat, mode}: {colorFormat: NonNullable<PluginCSSOptions['colorFormat']>; mode?: string}): string | number {
  switch (token.$type) {
    case 'color': {
      const {value, originalVal} = getMode(token, mode);
      return transformColor(isAlias(originalVal) ? value : originalVal, colorFormat); // note: use original value because it may have been normalized to hex (which matters if it wasn’t in sRGB gamut to begin with)
    }
    case 'dimension': {
      const {value} = getMode(token, mode);
      return transformDimension(value);
    }
    case 'duration': {
      const {value} = getMode(token, mode);
      return transformDuration(value);
    }
    case 'font' as 'fontFamily':
    case 'fontFamily': {
      const {value} = getMode(token, mode);
      return transformFontFamily(value);
    }
    case 'fontWeight': {
      const {value} = getMode(token, mode);
      return transformFontWeight(value);
    }
    case 'cubicBezier': {
      const {value} = getMode(token, mode);
      return transformCubicBezier(value);
    }
    case 'number': {
      const {value} = getMode(token, mode);
      return transformNumber(value);
    }
    case 'link': {
      const {value} = getMode(token, mode);
      return transformLink(value);
    }
    case 'strokeStyle': {
      const {value} = getMode(token, mode);
      return transformStrokeStyle(value);
    }
    // composite tokens
    case 'border': {
      const {value, originalVal} = getMode(token, mode);
      const width = transformDimension(value.width);
      const color = transformColor(typeof originalVal === 'string' || isAlias(originalVal.color) ? value.color : originalVal.color, colorFormat);
      const style = transformStrokeStyle(value.style);
      return `${width} ${style} ${color}`;
    }
    case 'shadow': {
      let {value, originalVal} = getMode(token, mode);
      // handle backwards compat for previous versions that didn’t always return array
      if (!Array.isArray(value)) value = [value];
      if (!Array.isArray(originalVal)) originalVal = [originalVal] as any;

      return value
        .map((shadow, i) => {
          const origShadow = originalVal[i]!;
          const offsetX = transformDimension(shadow.offsetX);
          const offsetY = transformDimension(shadow.offsetY);
          const blur = transformDimension(shadow.blur);
          const spread = transformDimension(shadow.spread);
          const color = transformColor(typeof origShadow === 'string' || isAlias(origShadow.color) ? shadow.color : origShadow.color, colorFormat);
          return `${shadow.inset ? 'inset ' : ''}${offsetX} ${offsetY} ${blur} ${spread} ${color}`;
        })
        .join(', ');
    }
    case 'gradient': {
      const {value, originalVal} = getMode(token, mode);
      return value
        .map((gradient, i) => {
          const origGradient = originalVal[i]!;
          const color = transformColor(typeof origGradient === 'string' || isAlias(origGradient.color) ? gradient.color : origGradient.color, colorFormat);
          const stop = `${100 * gradient.position}%`;
          return `${color} ${stop}`;
        })
        .join(', ');
    }
    case 'transition': {
      const {value} = getMode(token, mode);
      const duration = transformDuration(value.duration);
      const delay = value.delay ? transformDuration(value.delay) : undefined;
      const timingFunction = transformCubicBezier(value.timingFunction);
      return `${duration} ${delay ?? ''} ${timingFunction}`;
    }
    default: {
      throw new Error(`No transformer defined for $type: ${token.$type} tokens`);
    }
  }
}

function getMode<T extends {id: string; $value: any; $extensions?: any; _original: any}>(token: T, mode?: string): {value: T['$value']; originalVal: T['$value'] | string} {
  if (mode) {
    if (!token.$extensions?.mode || !token.$extensions.mode[mode]) throw new Error(`Token ${token.id} missing "$extensions.mode.${mode}"`);
    return {
      value: token.$extensions.mode[mode]!,
      originalVal: token._original.$extensions.mode[mode]!,
    };
  }
  return {value: token.$value, originalVal: token._original.$value};
}

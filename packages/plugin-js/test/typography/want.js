/**
 * Design Tokens
 * Autogenerated from tokens.json.
 * DO NOT EDIT!
 */

export const tokens = {
  'typography.family.body': ['IBM Plex Sans', '-system-ui', 'sans-serif'],
  'typography.family.heading': ['Helvetica'],
  'typography.page-title': {
    fontFamily: ['Helvetica'],
    fontSize: '48px',
    fontWeight: 600,
    lineHeight: 1.25,
    letterSpacing: '0.125em',
  },
  'typography.subheading': {
    fontFamily: ['Helvetica'],
    fontSize: '18px',
    fontWeight: 500,
    lineHeight: 1.375,
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
  },
  'typography.callout': {
    fontFamily: ['IBM Plex Sans', '-system-ui', 'sans-serif'],
    fontSize: '18px',
    fontWeight: 300,
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
  'typography.body': {
    fontFamily: ['IBM Plex Sans', '-system-ui', 'sans-serif'],
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: 1.5,
  },
};

export const meta = {
  'typography.family.body': {
    '$type': 'font',
    '$value': ['IBM Plex Sans', '-system-ui', 'sans-serif'],
  },
  'typography.family.heading': {
    '$type': 'font',
    '$value': 'Helvetica',
  },
  'typography.page-title': {
    '$type': 'typography',
    '$value': {
      fontFamily: 'Helvetica',
      fontSize: '48px',
      fontWeight: 600,
      lineHeight: 1.25,
      letterSpacing: '0.125em',
    },
  },
  'typography.subheading': {
    '$type': 'typography',
    '$value': {
      fontFamily: 'Helvetica',
      fontSize: '18px',
      fontWeight: 500,
      lineHeight: 1.375,
      letterSpacing: '0.25em',
      textTransform: 'uppercase',
    },
  },
  'typography.callout': {
    '$type': 'typography',
    '$value': {
      fontFamily: ['IBM Plex Sans', '-system-ui', 'sans-serif'],
      fontSize: '18px',
      fontWeight: 300,
      'font-style': 'italic',
      lineHeight: 1.5,
    },
  },
  'typography.body': {
    '$type': 'typography',
    '$value': {
      fontFamily: ['IBM Plex Sans', '-system-ui', 'sans-serif'],
      fontSize: '16px',
      fontWeight: 400,
      lineHeight: 1.5,
    },
  },
};

export const modes = {};

/** Get individual token */
export function token(tokenID, modeName) {
  if (modeName && modes[tokenID] && modeName in modes[tokenID]) return modes[tokenID][modeName];
  return tokens[tokenID];
}

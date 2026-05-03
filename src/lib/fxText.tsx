import React from 'react';

/**
 * Tiny inline FX markup parser.
 *
 * Syntax:
 *   ((word))                       -> default chroma fx, intensity 60
 *   ((word|fx-pulse))              -> override class, intensity 60
 *   ((word|fx-pulse|80))           -> override class + intensity
 *   ((word|chroma|80))             -> bare effect name (auto-prefixed with fx-)
 *
 * The inner content cannot contain ')' character.
 */
export type FxSegment =
    | { kind: 'text'; value: string }
  | { kind: 'fx'; value: string; className: string; intensity: number };

const FX_RE = /\(\(([^)]+?)\)\)/g;

export function parseFxText(input: string, opts?: { defaultClass?: string; defaultIntensity?: number }): FxSegment[] {
    const defaultClass = opts?.defaultClass ?? 'fx-chroma';
    const defaultIntensity = opts?.defaultIntensity ?? 60;
    const out: FxSegment[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    FX_RE.lastIndex = 0;
    while ((m = FX_RE.exec(input)) !== null) {
          if (m.index > last) out.push({ kind: 'text', value: input.slice(last, m.index) });
          const inner = m[1];
          const parts = inner.split('|').map((s) => s.trim());
          const word = parts[0] ?? '';
          let cls = parts[1] || defaultClass;
          if (cls && !cls.startsWith('fx-')) cls = 'fx-' + cls;
          const intensity = parts[2] ? Math.max(0, Math.min(100, Number(parts[2]) || defaultIntensity)) : defaultIntensity;
          out.push({ kind: 'fx', value: word, className: cls, intensity });
          last = m.index + m[0].length;
    }
    if (last < input.length) out.push({ kind: 'text', value: input.slice(last) });
    return out;
}

export interface FxTextProps {
    text: string;
    defaultClass?: string;
    defaultIntensity?: number;
    as?: keyof JSX.IntrinsicElements;
    className?: string;
}

export function FxText(props: FxTextProps) {
    const Tag: any = props.as || 'span';
    const segs = parseFxText(props.text, { defaultClass: props.defaultClass, defaultIntensity: props.defaultIntensity });
    const children = segs.map((s, i) => {
          if (s.kind === 'text') return React.createElement(React.Fragment, { key: i }, s.value);
          const style: any = { ['--fx-intensity']: String(s.intensity) };
          return React.createElement('span', { key: i, className: s.className, style }, s.value);
    });
    return React.createElement(Tag, { className: props.className }, children);
}

export default FxText;

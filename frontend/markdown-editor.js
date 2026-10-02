import {EditorState, Compartment, StateField, StateEffect} from '@codemirror/state';
import {EditorView, Decoration, ViewPlugin, WidgetType, keymap, lineNumbers, placeholder} from '@codemirror/view';
import {defaultKeymap, history, historyKeymap, undo, redo, invertedEffects} from '@codemirror/commands';
import {markdown, markdownLanguage, markdownKeymap} from '@codemirror/lang-markdown';
import {syntaxTree, syntaxHighlighting, HighlightStyle} from '@codemirror/language';
import {search, searchKeymap, openSearchPanel} from '@codemirror/search';
import {tags} from '@lezer/highlight';

// The editing model uses LF positions; untouched source retains its original
// line endings. History carries exact raw snapshots, including mixed EOLs.
function sourceHistory(initial) {
  const restore = StateEffect.define();
  const eol = initial.match(/\r\n|\r|\n/)?.[0] || '\n';
  const raw = StateField.define({
    create: () => initial,
    update(value, tr) {
      // A history group concatenates inverse effects newest-to-oldest. Its
      // final snapshot is the source matching the fully undone transaction.
      const restores = tr.effects.filter(effect => effect.is(restore));
      if (restores.length) return restores[restores.length - 1].value;
      if (!tr.docChanged) return value;
      let pos = 0, normalized = 0, result = '', copied = 0;
      function offset(target) {
        while (normalized < target) {
          if (value[pos] === '\r' && value[pos + 1] === '\n') pos++;
          pos++; normalized++;
        }
        return pos;
      }
      tr.changes.iterChanges((from, to, _a, _b, inserted) => {
        const start = offset(from), end = offset(to);
        result += value.slice(copied, start) + inserted.toString().replace(/\n/g, eol);
        copied = end;
      });
      return result + value.slice(copied);
    }
  });
  return {raw, extension: [raw, invertedEffects.of(tr => tr.docChanged ? [restore.of(tr.startState.field(raw))] : [])]};
}

class Bullet extends WidgetType {
  toDOM() { const span = document.createElement('span'); span.textContent = '•'; span.className = 'md-bullet'; return span; }
}
function liveDecorations(view) {
  const ranges = [], state = view.state;
  const active = (from, to) => state.selection.ranges.some(r =>
    state.doc.lineAt(r.from).from <= to && state.doc.lineAt(r.to).to >= from);
  const tree = syntaxTree(state);
  for (const visible of view.visibleRanges) tree.iterate({from:visible.from, to:visible.to, enter(node) {
    const {name, from, to} = node;
    const line = state.doc.lineAt(from);
    const heading = /^(?:ATX|Setext)Heading([1-6])$/.exec(name);
    if (heading) ranges.push(Decoration.line({class:'md-heading md-h' + heading[1]}).range(line.from));
    if (['StrongEmphasis','Emphasis','InlineCode','Strikethrough','Link'].includes(name)) {
      ranges.push(Decoration.mark({class:'md-' + name.toLowerCase()}).range(from,to));
    }
    if (['CodeBlock','FencedCode','Blockquote'].includes(name)) {
      for (let n = line.number; n <= state.doc.lineAt(to).number; n++) {
        const at = state.doc.line(n).from;
        if (at >= visible.from && at <= visible.to) ranges.push(Decoration.line({class:name === 'Blockquote' ? 'md-quote' : 'md-code-line'}).range(at));
      }
    }
    // Reveal syntax for the complete active/selected line, including mouse and
    // keyboard selections. Decorations never change the underlying Markdown.
    if (active(line.from,line.to)) return;
    if (['HeaderMark','EmphasisMark','CodeMark','StrikethroughMark','QuoteMark'].includes(name)) {
      // Keep multiline fences visible; hiding them changes vertical structure.
      if (name === 'CodeMark' && node.node.parent?.name !== 'InlineCode') return;
      ranges.push(Decoration.replace({}).range(from,to));
    }
    if (name === 'ListMark' && /^[-+*]$/.test(state.sliceDoc(from,to))) {
      ranges.push(Decoration.replace({widget:new Bullet()}).range(from,to));
    }
  }});
  return Decoration.set(ranges,true);
}
const live = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = liveDecorations(view); }
  update(update) {
    if (update.docChanged || update.selectionSet || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) this.decorations = liveDecorations(update.view);
  }
}, {decorations: value => value.decorations});
const colors = syntaxHighlighting(HighlightStyle.define([
  {tag:tags.heading, color:'#624b36', fontWeight:'600'},
  {tag:tags.strong, fontWeight:'700'},
  {tag:tags.emphasis, textDecoration:'underline'},
  {tag:[tags.processingInstruction,tags.meta], color:'#998775'},
  {tag:[tags.url,tags.link], color:'#37677d'},
  {tag:tags.monospace, color:'#624b36'}
]));

window.FinMarkdown = {
  create(parent, text, onChange) {
    parent.classList.remove('md-source');
    const appearance = new Compartment(), source = sourceHistory(text);
    const view = new EditorView({parent, state:EditorState.create({doc:text, extensions:[
      markdown({base:markdownLanguage, addKeymap:false, completeHTMLTags:false}),
      history(), source.extension, EditorView.lineWrapping, colors,
      search({top:true}), keymap.of([...markdownKeymap,...historyKeymap,...searchKeymap,...defaultKeymap]),
      EditorView.contentAttributes.of({'aria-label':'Markdown schreiben',spellcheck:'true'}),
      placeholder('Schreiben…  # für eine Überschrift, - für eine Liste'),
      appearance.of(live),
      EditorView.updateListener.of(update => {if(update.docChanged) onChange(update.state.field(source.raw));})
    ]})});
    return {
      setMode(mode) {
        const top = view.scrollDOM.scrollTop;
        view.dispatch({effects:appearance.reconfigure(mode === 'source' ? lineNumbers() : live)});
        parent.classList.toggle('md-source',mode === 'source');
        view.contentDOM.setAttribute('aria-label',mode === 'source' ? 'Markdown-Quelltext' : 'Markdown schreiben');
        view.scrollDOM.scrollTop = top;
        view.requestMeasure();
      },
      undo: () => undo(view), redo: () => redo(view),
      search: () => {openSearchPanel(view);},
      focus: () => {view.focus();view.requestMeasure();},
      measure: () => view.requestMeasure(),
      destroy: () => view.destroy(),
      getText: () => view.state.field(source.raw)
    };
  }
};

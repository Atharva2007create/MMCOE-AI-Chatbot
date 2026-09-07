import assert from 'node:assert/strict';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';
import test from 'node:test';

test('harmless unsafe markup is removed before rendering', () => {
  const dom = new JSDOM('<div id="target"></div>');
  const purify = createDOMPurify(dom.window);
  const payload = '<img src=x onerror="document.body.dataset.executed=\'yes\'"><script>document.body.dataset.executed=\'yes\'</script>Safe';
  const clean = purify.sanitize(marked.parse(payload), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['style']
  });
  dom.window.document.getElementById('target').innerHTML = clean;
  assert.equal(dom.window.document.querySelector('script'), null);
  assert.equal(dom.window.document.querySelector('img')?.hasAttribute('onerror'), false);
  assert.equal(dom.window.document.body.dataset.executed, undefined);
  assert.match(dom.window.document.body.textContent, /Safe/);
});

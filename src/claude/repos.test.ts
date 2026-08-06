import assert from 'node:assert/strict'
import { test } from 'node:test'

import { repoSlug } from './repos'

test('repoSlug reads every form git hands back', () => {
  assert.equal(repoSlug('git@github.com:alexjmold/giggull.git'), 'alexjmold/giggull')
  assert.equal(repoSlug('https://github.com/sanity-io/workflows.git'), 'sanity-io/workflows')
  assert.equal(repoSlug('https://github.com/sanity-io/workflows'), 'sanity-io/workflows')
  assert.equal(repoSlug('ssh://git@github.com/sanity-io/workflows.git'), 'sanity-io/workflows')
  assert.equal(repoSlug('  git@github.com:sanity-io/ada.git\n'), 'sanity-io/ada')
})

test('repoSlug keeps a name that itself ends in .git', () => {
  assert.equal(repoSlug('git@github.com:alexjmold/dotfiles.git.git'), 'alexjmold/dotfiles.git')
})

test('repoSlug declines anything that is not GitHub', () => {
  assert.equal(repoSlug('git@gitlab.com:alexjmold/thing.git'), undefined)
  assert.equal(repoSlug(''), undefined)
  assert.equal(repoSlug('/Users/alex/Projects/local-only'), undefined)
})

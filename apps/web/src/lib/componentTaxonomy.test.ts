import { describe, expect, it } from 'vitest';
import { createStockRegistry } from '@lostintospace/simulation-engine/core/catalog';

import { CATEGORY, GROUPS, categoryLabel, classify, partSummary } from './componentTaxonomy';

/**
 * The taxonomy must cover the registry, exhaustively.
 *
 * This exists because it already failed once in production. Rocket Lab's label
 * map was missing eight of the twenty-one categories, so the filter bar
 * rendered `motor_mount`, `centering_ring`, `sensor`, `fairing`, `coupler` and
 * `interstage` as raw enum keys in the interface — a schema leak that no
 * typecheck catches, because a missing key in a partial `Record` is legal and a
 * lookup miss just returns undefined.
 *
 * Adding a component category to the engine now fails here instead.
 */

const components = createStockRegistry().listAll();
const categories = [...new Set(components.map((c) => c.category))].sort();

describe('the taxonomy covers the registry', () => {
  it('describes every category the registry produces', () => {
    const undescribed = categories.filter((c) => !(c in CATEGORY));
    expect(
      undescribed,
      'These categories exist in the engine but have no entry in CATEGORY, so ' +
        'the interface would show their raw enum keys:\n' +
        undescribed.join('\n'),
    ).toEqual([]);
  });

  it('places every category into exactly one family', () => {
    const placed = GROUPS.flatMap((g) => g.categories as readonly string[]);
    const unplaced = categories.filter((c) => !placed.includes(c));
    expect(unplaced, `Not in any GROUPS entry: ${unplaced.join(', ')}`).toEqual([]);

    const duplicated = placed.filter((c, i) => placed.indexOf(c) !== i);
    expect(duplicated, `In more than one family: ${duplicated.join(', ')}`).toEqual([]);
  });

  it('never renders a raw enum key as a label', () => {
    for (const category of categories) {
      const label = categoryLabel(category);
      expect(label, category).not.toContain('_');
      expect(label[0], `${category} label should be capitalised`).toBe(
        label[0]!.toUpperCase(),
      );
    }
  });

  it('classifies every component into a group, losing none', () => {
    const grouped = classify(components);
    const total = grouped.reduce((sum, g) => sum + g.total, 0);
    expect(total).toBe(components.length);
  });

  it('gives every component a distinguishing summary', () => {
    for (const component of components) {
      const summary = partSummary(component);
      expect(summary.length, `${component.id} has no summary`).toBeGreaterThan(0);
      expect(summary, `${component.id} summary leaks an enum key`).not.toMatch(/_/);
    }
  });
});

describe('groups are ordered the way a build proceeds', () => {
  it('starts with the airframe and ends with recovery', () => {
    expect(GROUPS[0]!.label).toBe('Airframe');
    expect(GROUPS[GROUPS.length - 1]!.label).toBe('Recovery');
  });

  it('gives every family a name and a purpose', () => {
    for (const group of GROUPS) {
      expect(group.label.length).toBeGreaterThan(0);
      expect(group.blurb.length, `${group.label} has no blurb`).toBeGreaterThan(0);
      expect(group.categories.length, `${group.label} is empty`).toBeGreaterThan(0);
    }
  });
});

import { TUPriorityManager } from '../priority-manager.js';

describe('TUPriorityManager', () => {
  test('prioritizes by creation ID', () => {
    const manager = new TUPriorityManager({ creationId: 'preferred-creator' });
    
    const existingTU = { '@_creationid': 'other-creator' };
    const newTU = { '@_creationid': 'preferred-creator' };
    
    expect(manager.compareTranslationUnits(existingTU, newTU)).toBe(true);
  });

  test('prioritizes by change ID', () => {
    const manager = new TUPriorityManager({ changeId: 'preferred-editor' });
    
    const existingTU = { '@_changeid': 'other-editor' };
    const newTU = { '@_changeid': 'preferred-editor' };
    
    expect(manager.compareTranslationUnits(existingTU, newTU)).toBe(true);
  });

  test('prioritizes by change date', () => {
    const manager = new TUPriorityManager({ changeDate: true });
    
    const existingTU = { '@_changedate': '20240101T000000Z' };
    const newTU = { '@_changedate': '20240102T000000Z' };
    
    expect(manager.compareTranslationUnits(existingTU, newTU)).toBe(true);
  });

  test('prioritizes by creation date', () => {
    const manager = new TUPriorityManager({ creationDate: true });
    
    const existingTU = { '@_creationdate': '20240101T000000Z' };
    const newTU = { '@_creationdate': '20240102T000000Z' };
    
    expect(manager.compareTranslationUnits(existingTU, newTU)).toBe(true);
  });
});
import { describe, it, expect, vi } from 'vitest';
import { extractPasswordFieldsToPurge, runPurge } from '../scripts/purge_password_fields';

describe('Étape 1.6 : Purge du champ password (S-03)', () => {
  it('extrait correctement les champs sensibles password et lastPasswordChangeDate', () => {
    expect(extractPasswordFieldsToPurge({})).toEqual([]);
    expect(extractPasswordFieldsToPurge({ name: 'Alice' })).toEqual([]);
    expect(extractPasswordFieldsToPurge({ password: 'secret' })).toEqual(['password']);
    expect(extractPasswordFieldsToPurge({ password: 'secret', lastPasswordChangeDate: '2026-01-01' })).toEqual([
      'password',
      'lastPasswordChangeDate',
    ]);
  });

  it('identifie les champs password et simule la suppression en mode dry-run', async () => {
    const updateMock = vi.fn();
    const fakeDocs = [
      {
        id: 'user_1',
        data: () => ({ name: 'Alice', password: 'hash123', lastPasswordChangeDate: '2026-01-01' }),
        ref: { update: updateMock },
      },
      {
        id: 'user_2',
        data: () => ({ name: 'Bob' }),
        ref: { update: updateMock },
      },
    ];

    const mockDb: any = {
      collection: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          docs: fakeDocs,
          size: fakeDocs.length,
        }),
      }),
    };

    const mockFieldValue = {
      delete: vi.fn().mockReturnValue('__DELETE__'),
    };

    const resDry = await runPurge(mockDb, mockFieldValue, true);
    expect(resDry.purgedUsers).toBe(1);
    expect(updateMock).not.toHaveBeenCalled();

    const resLive = await runPurge(mockDb, mockFieldValue, false);
    expect(resLive.purgedUsers).toBe(1);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({
      password: '__DELETE__',
      lastPasswordChangeDate: '__DELETE__',
    });
  });
});

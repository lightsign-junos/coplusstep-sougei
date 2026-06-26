import type { Member } from '../types';

/**
 * 送迎表用の表示名を返す。
 * - 苗字が一意 → 苗字のみ
 * - 苗字が重複 → 苗字 + 名前読みの1文字目ひらがな（例: 田中た）
 */
export function getMemberDisplayName(member: Member, allMembers: Member[]): string {
  const surname = member.name.split(' ')[0];
  const duplicated = allMembers.filter(m => m.name.split(' ')[0] === surname).length > 1;

  if (!duplicated) return surname;

  const givenKana = (member.nameKana ?? '').split(' ')[1] ?? '';
  const initial = givenKana.charAt(0);
  return initial ? `${surname}${initial}` : surname;
}

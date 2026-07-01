import type { Member } from '../types';

/**
 * 送迎表用の表示名を返す。
 * - 苗字が一意 → 苗字のみ
 * - 苗字が重複 → 苗字 + 名前読みの1文字目ひらがな（例: 田中た）
 */
function splitName(name: string): [string, string] {
  // 全角・半角スペースどちらでも分割
  const parts = name.split(/[\s　]+/);
  return [parts[0] ?? name, parts[1] ?? ''];
}

export function getMemberDisplayName(member: Member, allMembers: Member[]): string {
  const [surname] = splitName(member.name);
  const duplicated = allMembers.filter(m => splitName(m.name)[0] === surname).length > 1;

  if (!duplicated) return surname;

  const [, givenKana] = splitName(member.nameKana ?? '');
  const initial = givenKana.charAt(0);
  return initial ? `${surname}${initial}` : surname;
}

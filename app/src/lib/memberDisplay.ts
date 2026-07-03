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

// よくある名字の読み（ふりがな未入力でも五十音順に並べるため）
const SURNAME_KANA: Record<string, string> = {
  阿部: 'あべ', 安藤: 'あんどう', 伊藤: 'いとう', 井上: 'いのうえ', 今井: 'いまい',
  上田: 'うえだ', 遠藤: 'えんどう', 大野: 'おおの', 岡田: 'おかだ', 小野: 'おの',
  加藤: 'かとう', 金子: 'かねこ', 鹿島: 'かしま', 川崎: 'かわさき', 川村: 'かわむら',
  菊池: 'きくち', 菊地: 'きくち', 木村: 'きむら', 工藤: 'くどう', 小林: 'こばやし', 近藤: 'こんどう',
  斎藤: 'さいとう', 斉藤: 'さいとう', 佐々木: 'ささき', 佐藤: 'さとう', 澤田: 'さわだ',
  島田: 'しまだ', 清水: 'しみず', 鈴木: 'すずき', 砂田: 'すなだ', 関口: 'せきぐち',
  高橋: 'たかはし', 田尻: 'たじり', 田中: 'たなか', 田村: 'たむら', 千葉: 'ちば',
  中川: 'なかがわ', 中島: 'なかじま', 中村: 'なかむら', 西村: 'にしむら', 野口: 'のぐち',
  橋本: 'はしもと', 長谷川: 'はせがわ', 林: 'はやし', 原田: 'はらだ', 福田: 'ふくだ',
  藤田: 'ふじた', 藤本: 'ふじもと', 前田: 'まえだ', 松本: 'まつもと', 三浦: 'みうら',
  村上: 'むらかみ', 森: 'もり', 山口: 'やまぐち', 山田: 'やまだ', 山本: 'やまもと',
  吉田: 'よしだ', 米山: 'よねやま', 渡辺: 'わたなべ', 渡邊: 'わたなべ', 渡邉: 'わたなべ',
};

/**
 * 五十音ソート用のキーを返す。
 * 優先順: ふりがな → 名字辞書の読み（+残りの文字） → 氏名そのまま
 */
export function getMemberSortKey(member: Member): string {
  if (member.nameKana && member.nameKana.trim()) return member.nameKana.trim();
  const name = member.name.trim();
  // 長い名字から順に前方一致（例: 佐々木 を 佐藤 より先に判定）
  const surnames = Object.keys(SURNAME_KANA).sort((a, b) => b.length - a.length);
  for (const s of surnames) {
    if (name.startsWith(s)) return SURNAME_KANA[s] + name.slice(s.length);
  }
  return name;
}

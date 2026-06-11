// Team metadata for the 48 World Cup squads: flag emoji + CN/EN display names.
// Forecast archives use several name variants (FIFA vs common forms); resolve()
// normalizes any known alias to the canonical entry.

export interface TeamMeta {
  readonly flag: string;
  readonly cn: string;
  readonly en: string;
  readonly group: string;
}

const TEAMS: Record<string, TeamMeta> = {
  Mexico: { flag: "🇲🇽", cn: "墨西哥", en: "Mexico", group: "A" },
  "South Korea": { flag: "🇰🇷", cn: "韩国", en: "South Korea", group: "A" },
  Czechia: { flag: "🇨🇿", cn: "捷克", en: "Czechia", group: "A" },
  "South Africa": { flag: "🇿🇦", cn: "南非", en: "South Africa", group: "A" },
  Switzerland: { flag: "🇨🇭", cn: "瑞士", en: "Switzerland", group: "B" },
  Canada: { flag: "🇨🇦", cn: "加拿大", en: "Canada", group: "B" },
  "Bosnia and Herzegovina": { flag: "🇧🇦", cn: "波黑", en: "Bosnia & Herzegovina", group: "B" },
  Qatar: { flag: "🇶🇦", cn: "卡塔尔", en: "Qatar", group: "B" },
  Brazil: { flag: "🇧🇷", cn: "巴西", en: "Brazil", group: "C" },
  Morocco: { flag: "🇲🇦", cn: "摩洛哥", en: "Morocco", group: "C" },
  Scotland: { flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", cn: "苏格兰", en: "Scotland", group: "C" },
  Haiti: { flag: "🇭🇹", cn: "海地", en: "Haiti", group: "C" },
  USA: { flag: "🇺🇸", cn: "美国", en: "USA", group: "D" },
  Türkiye: { flag: "🇹🇷", cn: "土耳其", en: "Türkiye", group: "D" },
  Paraguay: { flag: "🇵🇾", cn: "巴拉圭", en: "Paraguay", group: "D" },
  Australia: { flag: "🇦🇺", cn: "澳大利亚", en: "Australia", group: "D" },
  Germany: { flag: "🇩🇪", cn: "德国", en: "Germany", group: "E" },
  Ecuador: { flag: "🇪🇨", cn: "厄瓜多尔", en: "Ecuador", group: "E" },
  "Ivory Coast": { flag: "🇨🇮", cn: "科特迪瓦", en: "Côte d'Ivoire", group: "E" },
  "Curaçao": { flag: "🇨🇼", cn: "库拉索", en: "Curaçao", group: "E" },
  Netherlands: { flag: "🇳🇱", cn: "荷兰", en: "Netherlands", group: "F" },
  Japan: { flag: "🇯🇵", cn: "日本", en: "Japan", group: "F" },
  Sweden: { flag: "🇸🇪", cn: "瑞典", en: "Sweden", group: "F" },
  Tunisia: { flag: "🇹🇳", cn: "突尼斯", en: "Tunisia", group: "F" },
  Belgium: { flag: "🇧🇪", cn: "比利时", en: "Belgium", group: "G" },
  Egypt: { flag: "🇪🇬", cn: "埃及", en: "Egypt", group: "G" },
  Iran: { flag: "🇮🇷", cn: "伊朗", en: "Iran", group: "G" },
  "New Zealand": { flag: "🇳🇿", cn: "新西兰", en: "New Zealand", group: "G" },
  Spain: { flag: "🇪🇸", cn: "西班牙", en: "Spain", group: "H" },
  Uruguay: { flag: "🇺🇾", cn: "乌拉圭", en: "Uruguay", group: "H" },
  "Saudi Arabia": { flag: "🇸🇦", cn: "沙特", en: "Saudi Arabia", group: "H" },
  "Cape Verde": { flag: "🇨🇻", cn: "佛得角", en: "Cape Verde", group: "H" },
  France: { flag: "🇫🇷", cn: "法国", en: "France", group: "I" },
  Norway: { flag: "🇳🇴", cn: "挪威", en: "Norway", group: "I" },
  Senegal: { flag: "🇸🇳", cn: "塞内加尔", en: "Senegal", group: "I" },
  Iraq: { flag: "🇮🇶", cn: "伊拉克", en: "Iraq", group: "I" },
  Argentina: { flag: "🇦🇷", cn: "阿根廷", en: "Argentina", group: "J" },
  Austria: { flag: "🇦🇹", cn: "奥地利", en: "Austria", group: "J" },
  Algeria: { flag: "🇩🇿", cn: "阿尔及利亚", en: "Algeria", group: "J" },
  Jordan: { flag: "🇯🇴", cn: "约旦", en: "Jordan", group: "J" },
  Portugal: { flag: "🇵🇹", cn: "葡萄牙", en: "Portugal", group: "K" },
  Colombia: { flag: "🇨🇴", cn: "哥伦比亚", en: "Colombia", group: "K" },
  "Congo DR": { flag: "🇨🇩", cn: "刚果民主", en: "DR Congo", group: "K" },
  Uzbekistan: { flag: "🇺🇿", cn: "乌兹别克斯坦", en: "Uzbekistan", group: "K" },
  England: { flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", cn: "英格兰", en: "England", group: "L" },
  Croatia: { flag: "🇭🇷", cn: "克罗地亚", en: "Croatia", group: "L" },
  Ghana: { flag: "🇬🇭", cn: "加纳", en: "Ghana", group: "L" },
  Panama: { flag: "🇵🇦", cn: "巴拿马", en: "Panama", group: "L" }
};

const ALIASES: Record<string, string> = {
  "Korea Republic": "South Korea",
  "Côte d'Ivoire": "Ivory Coast",
  "United States": "USA",
  "Cabo Verde": "Cape Verde",
  "DR Congo": "Congo DR",
  "Bosnia-Herzegovina": "Bosnia and Herzegovina",
  "IR Iran": "Iran",
  Turkiye: "Türkiye"
};

export function resolveTeam(name: string): TeamMeta {
  const key = ALIASES[name] ?? name;
  return TEAMS[key] ?? { flag: "🏳️", cn: name, en: name, group: "?" };
}

export const ALL_TEAMS: ReadonlyArray<readonly [string, TeamMeta]> = Object.entries(TEAMS);

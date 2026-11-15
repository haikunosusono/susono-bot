/**
 * 俳句の裾野 公式X (@haikunosusono) 自動投稿テンプレート定義
 * susono-bot 組み込み用データ（ES Modules / CommonJS 両対応・JSON互換構造）
 * 出典：Gemini の監査・文面案（2026-11-15、服部が共有）。組み込みはクラウド側で。
 */

export const POST_TEMPLATES = {
  // 1. 1時間前リマインド（画像なし・URLカードのみ）
  reminder_1h: [
    {
      id: "reminder_1h_stock",
      label: "ストッ句からの参加を促す（夜・忙しい人向け）",
      targetSlot: ["night", "any"],
      attachImage: false,
      variables: ["startTime", "kadai", "url"],
      text: "{startTime}の定例句会まで、あと1時間です。\n今日の兼題は「{kadai}」。\n\nいまからひねり出さなくても大丈夫です。「ストッ句」に入れてある作り置きの句を、ぽんと1句出すだけでも参加できます。\nお茶を飲みながら、気楽にどうぞ。\n\n{url}"
    },
    {
      id: "reminder_1h_casual",
      label: "その場で1句つくる気軽さを促す（昼・隙間時間向け）",
      targetSlot: ["day", "any"],
      attachImage: false,
      variables: ["startTime", "kadai", "url"],
      text: "あと1時間で、{startTime}の句会がはじまります。\n兼題は「{kadai}」です。\n\nうまく作ろうとしなくて大丈夫。「{kadai}といえば、さっき見たあれかな」くらいの種がひとつあれば、5分で作ってそのまま出せます。\nちょっと一息つきにきませんか。\n\n{url}"
    },
    {
      id: "reminder_1h_unpublished",
      label: "未発表ルールの安心感を添える（投句先がある人向け）",
      targetSlot: ["any"],
      attachImage: false,
      variables: ["startTime", "kadai", "url"],
      text: "{startTime}からの句会、投句を受け付けています（あと1時間）。\n今日の兼題は「{kadai}」です。\n\n裾野の句会は、外に句も俳号も出ない「未発表あつかい」の練習場です。\nよそへ投句する前の試し詠みにも、ぜひ使ってください。\n\n{url}"
    }
  ],

  // 2. お礼・開催された回（結果と熱量が主役・機能紹介画像は付けない）
  thanks_held: [
    {
      id: "thanks_held_lively",
      label: "接戦・盛り上がった回向け（短冊と句碑へ一言接続）",
      targetSlot: ["any"],
      attachImage: false,
      featureHint: "短冊と句碑",
      variables: ["startTime", "kadai", "participantCount", "kuCount", "topScore"],
      text: "{startTime}の定例句会（兼題：{kadai}）、無事に結びとなりました。\n今回は{participantCount}名・{kuCount}句が集まり、トップは{topScore}点でした！\n\n優勝された方、おめでとうございます。そして選句・選評を寄せてくださった皆さま、ありがとうございました。\n今日の句を「短冊と句碑」にして手元に残したい方は、マイページからいつでも作れます。"
    },
    {
      id: "thanks_held_calm",
      label: "少人数・じっくり味わう回向け（自選十句へ一言接続）",
      targetSlot: ["day", "any"],
      attachImage: false,
      featureHint: "自選十句・句集づくり",
      variables: ["startTime", "kadai", "participantCount", "kuCount"],
      text: "{startTime}の定例句会（兼題：{kadai}）、おつかれさまでした。\n{participantCount}名で{kuCount}句を囲み、1句ずつじっくり味わう回になりました。優勝された方、おめでとうございます！\n\nいただいた選評やご自身の句は、外には出ない皆さまだけの記録です。\n気に入った句があれば、忘れないうちに「自選十句」へそっと並べておいてくださいね。"
    },
    {
      id: "thanks_held_night_review",
      label: "夜の回向け（選句の道具・夏雲連携へ一言接続）",
      targetSlot: ["night"],
      attachImage: false,
      featureHint: "選句の道具（夏雲へ選をのせる）",
      variables: ["startTime", "kadai", "kuCount"],
      text: "{startTime}の定例句会（兼題：{kadai}）、ご参加ありがとうございました！\n{kuCount}句のなかから選ばれた本日の1位、お見事でした。\n\n「どの句に点を入れるか迷った」という方は、句会のあとに選句の道具（夏雲へ選をのせる仕組み）もぜひ試してみてください。振り返りがぐっと楽になります。\nまた次の句会でお待ちしています。"
    }
  ],

  // 3. 機能要望・ご意見募集（週1〜2回の対話枠）
  feedback_request: [
    {
      id: "feedback_request_choices",
      label: "時間帯や使い心地を聞く（3つの切り口提示型）",
      targetSlot: ["any"],
      attachImage: false,
      variables: [],
      text: "いつも俳句の裾野を使ってくださり、ありがとうございます。\nこつこつ手を入れながら育てているアプリなのですが、皆さまの声を少し聞かせてください。\n\n・「この時間帯に句会があったら出やすい」\n・「ここがもうちょっと押しやすいと嬉しい」\n・「こんな練習道具があったらいいな」\n\n小さなことでも大歓迎です。このポストへのリプで、気軽に教えてもらえると嬉しいです。"
    },
    {
      id: "feedback_request_tools",
      label: "既存機能紹介を兼ねた問いかけ型",
      targetSlot: ["any"],
      attachImage: false,
      variables: [],
      text: "俳句の裾野には、いま「ストッ句」「俳筋力トレーニング」「短冊と句碑」「自選十句」などの道具があります。\n\nふだん句を作るとき、「こういうメモ欄がほしい」「こんなふうに季語を探したい」と困ることはありませんか？\nぜんぶすぐには難しくても、できるところから形にしていきたいと思っています。思いついたことがあれば、ぜひリプで教えてください。"
    }
  ],

  // 4. 名句碑鑑賞（参加者なしのおやすみ回・または定期の看板企画／画像2枚添付）
  meiku_monument: [
    {
      id: "meiku_monument_compare",
      label: "石や風景の違いに注目させる（基本形）",
      targetSlot: ["rest", "regular"],
      attachImage: true,
      imageCount: 2,
      variables: ["meiku", "author", "placeA", "placeB"],
      text: "【裾野の名句碑くらべ】\n『{meiku}』 {author}\n\n同じ1句でも、建っている土地や石の表情、文字の彫り方で、立ち上がってくる景色がずいぶん変わります。\n1枚目は{placeA}、2枚目は{placeB}の句碑イメージです。\n\nみなさんは、どちらの佇まいがお好きですか？\n\n#俳句の裾野 #裾野の名句碑"
    },
    {
      id: "meiku_monument_night",
      label: "自分の句碑づくりへ自然につなげる（おやすみ回の夜など）",
      targetSlot: ["rest", "night"],
      attachImage: true,
      imageCount: 2,
      variables: ["meiku", "author", "featureA", "featureB"],
      text: "【今夜の名句鑑賞】\n『{meiku}』 {author}\n\n紙の上で読むのと、こうして石に刻まれた姿で見るのとでは、言葉の重みがまた違って見えますね。\n（1枚目：{featureA}／2枚目：{featureB}）\n\n俳句の裾野でも、ご自身の句をこうした「句碑」や「短冊」の画像にして手元で楽しめます。今日の1句ができたら、ぜひ石に刻んでみてください。\n\n#俳句の裾野 #裾野の名句碑"
    }
  ]
};

/**
 * 指定カテゴリのテンプレートをランダム（またはID指定）で取得し、変数を埋め込んで返すヘルパー関数
 */
export function buildPostText(category, params = {}, options = {}) {
  const list = POST_TEMPLATES[category];
  if (!list || list.length === 0) {
    throw new Error(`Unknown template category: ${category}`);
  }

  let candidates = list;
  if (options.id) {
    candidates = list.filter((item) => item.id === options.id);
  } else if (options.slot) {
    const slotFiltered = list.filter(
      (item) => item.targetSlot.includes(options.slot) || item.targetSlot.includes("any")
    );
    if (slotFiltered.length > 0) {
      candidates = slotFiltered;
    }
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)] || list[0];

  const defaultParams = {
    url: "https://haikunosusono.web.app",
    ...params
  };

  const renderedText = chosen.text.replace(/\{(\w+)\}/g, (_, key) => {
    return defaultParams[key] !== undefined ? String(defaultParams[key]) : `{${key}}`;
  });

  return {
    id: chosen.id,
    text: renderedText,
    attachImage: chosen.attachImage
  };
}

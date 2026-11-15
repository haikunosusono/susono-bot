/**
 * 俳句の裾野 公式X (@haikunosusono) 自動投稿スケジュール定義
 *
 * 【設計方針（ミュート・離脱防止）】
 * ・平日：従来の15本/日 → 最大5〜6本/日に圧縮
 * ・土日祝：従来の27本/日 → 最大6〜8本/日に圧縮
 * ・「1時間前・開始・実況」の毎回連投をやめ、昼の部・夜の部の「まとめ案内」に集約
 * ・各句会の終了後は「参加者がいた回のお礼」を優先し、参加者ゼロ（おやすみ）の名句碑投稿は1日1回までに制限
 * ・25時（深夜1時）回はタイムライン連投を避けるため、参加者がいた場合のお礼のみ（おやすみ時はX投稿スキップ）
 *
 * 出典：Gemini の監査・設計案（2026-11-15、服部が共有）。組み込みはクラウド側で。
 * 句会の終了時刻（現在は各回の50分後で仮置き）や祝日判定は、ボット側の仕様に合わせて調整のこと。
 */

export const SCHEDULE_CONFIG = {
  timezone: "Asia/Tokyo",

  dailyLimits: {
    maxMeikuFallbackPerDay: 1,
    skipLateNightFallback: true
  },

  // 0:日, 1:月, 2:火, 3:水, 4:木, 5:金, 6:土
  noonRotationByDayOfWeek: {
    0: { type: "skip", reason: "日曜は昼の句会（10時・13時・15時）のお礼と重なるため休止" },
    1: { type: "meiku_monument", label: "月曜：名句碑くらべ（週明けの読み物）" },
    2: { type: "feature_intro_light", label: "火曜：はじめての方へ・季語をしらべる" },
    3: { type: "meiku_monument", label: "水曜：名句碑くらべ（週なかの読み物）" },
    4: { type: "feature_intro_light", label: "木曜：すぐ1句つくれる句づくり・俳筋力" },
    5: { type: "meiku_monument", label: "金曜：名句碑くらべ（週末前の読み物）" },
    6: { type: "skip", reason: "土曜は昼の句会（10時・13時・15時）のお礼と重なるため休止" }
  },

  eveningRotationByDayOfWeek: {
    0: { type: "feedback_request", label: "日曜：機能要望・ご意見募集（週末の振り返り）" },
    1: { type: "night_digest_reminder", label: "月曜：夜の句会（21/23/25時）案内＋ストッ句紹介" },
    2: { type: "night_digest_reminder", label: "火曜：夜の句会案内＋今夜の兼題ヒント" },
    3: { type: "feedback_request", label: "水曜：機能要望・ご意見募集（週なかの対話枠）" },
    4: { type: "night_digest_reminder", label: "木曜：夜の句会案内＋未発表ルールの安心案内" },
    5: { type: "night_digest_reminder", label: "金曜：週末夜の句会案内＋ストッ句紹介" },
    6: { type: "night_digest_reminder", label: "土曜：夜の句会案内＋短冊・句碑の紹介" }
  },

  weekdayJobs: [
    {
      id: "weekday_morning_kadai",
      time: "07:00",
      cron: "0 7 * * 1-5",
      action: "post_morning_kadai",
      attachImage: false,
      description: "朝の兼題発表（写真なし・軽く）"
    },
    {
      id: "weekday_noon_slot",
      time: "12:05",
      cron: "5 12 * * 1-5",
      action: "post_noon_rotation",
      attachImage: "depends_on_rotation",
      description: "昼休みの読み物（月水金：名句碑2枚／火木：軽い機能紹介）"
    },
    {
      id: "weekday_evening_slot",
      time: "19:00",
      cron: "0 19 * * 1-5",
      action: "post_evening_rotation",
      attachImage: false,
      description: "夜の部（21・23・25時）まとめ案内、水曜のみ機能要望募集"
    },
    {
      id: "weekday_kukai_2000_reminder",
      time: "20:00",
      cron: "0 20 * * 1-5",
      action: "post_reminder_1h",
      targetKukaiSlot: "21:00",
      attachImage: false,
      description: "黄金帯（21:00回）のみ1時間前リマインドを個別送信（23時・25時の事前リマインドは省略）"
    },
    {
      id: "weekday_kukai_2100_result",
      time: "21:50",
      cron: "50 21 * * 1-5",
      action: "post_kukai_result_or_fallback",
      targetKukaiSlot: "21:00",
      allowMeikuFallback: true,
      description: "21:00回お礼（結果主役）。参加者0なら名句碑鑑賞（当日未送信の場合のみ）"
    },
    {
      id: "weekday_kukai_2300_result",
      time: "23:50",
      cron: "50 23 * * 1-5",
      action: "post_kukai_result_or_fallback",
      targetKukaiSlot: "23:00",
      allowMeikuFallback: true,
      description: "23:00回お礼（結果主役）。参加者0かつ21時回で名句碑を出していなければ名句碑鑑賞"
    },
    {
      id: "weekday_kukai_2500_result",
      time: "01:50",
      cron: "50 1 * * 2-6",
      action: "post_kukai_result_only_if_held",
      targetKukaiSlot: "25:00",
      allowMeikuFallback: false,
      description: "25:00回は開催された場合のみお礼を投稿（不成立時は深夜TL保護のため投稿しない）"
    }
  ],

  weekendHolidayJobs: [
    {
      id: "weekend_morning_kadai",
      time: "07:00",
      cron: "0 7 * * 0,6",
      action: "post_morning_kadai",
      attachImage: false,
      description: "朝の兼題発表（写真なし・軽く）"
    },
    {
      id: "weekend_day_kukai_digest",
      time: "09:00",
      cron: "0 9 * * 0,6",
      action: "post_day_digest_reminder",
      targetKukaiSlots: ["10:00", "13:00", "15:00"],
      attachImage: false,
      description: "昼の部（10時・13時・15時）のまとめ1時間前案内（13時・15時の個別リマインドは省略）"
    },
    {
      id: "weekend_kukai_1000_result",
      time: "10:50",
      cron: "50 10 * * 0,6",
      action: "post_kukai_result_or_fallback",
      targetKukaiSlot: "10:00",
      allowMeikuFallback: false,
      description: "10:00回お礼（開催時のみ投稿。13時・15時がすぐ続くため不成立時はスキップ）"
    },
    {
      id: "weekend_kukai_1300_result",
      time: "13:50",
      cron: "50 13 * * 0,6",
      action: "post_kukai_result_or_fallback",
      targetKukaiSlot: "13:00",
      allowMeikuFallback: false,
      description: "13:00回お礼（開催時のみ投稿）"
    },
    {
      id: "weekend_kukai_1500_result",
      time: "15:50",
      cron: "50 15 * * 0,6",
      action: "post_kukai_result_or_fallback",
      targetKukaiSlot: "15:00",
      allowMeikuFallback: true,
      description: "15:00回お礼。昼の部3回とも不成立だった場合は、ここで昼の名句碑鑑賞を1回出す"
    },
    {
      id: "weekend_evening_slot",
      time: "19:00",
      cron: "0 19 * * 0,6",
      action: "post_evening_rotation",
      attachImage: false,
      description: "土曜：夜の部まとめ案内／日曜：機能要望・ご意見募集"
    },
    {
      id: "weekend_kukai_2000_reminder",
      time: "20:00",
      cron: "0 20 * * 0,6",
      action: "post_reminder_1h",
      targetKukaiSlot: "21:00",
      attachImage: false,
      description: "黄金帯（21:00回）の1時間前リマインド"
    },
    {
      id: "weekend_kukai_2100_result",
      time: "21:50",
      cron: "50 21 * * 0,6",
      action: "post_kukai_result_or_fallback",
      targetKukaiSlot: "21:00",
      allowMeikuFallback: true,
      description: "21:00回お礼（不成立かつ当日まだ名句碑を出していなければ名句碑鑑賞）"
    },
    {
      id: "weekend_kukai_2300_result",
      time: "23:50",
      cron: "50 23 * * 0,6",
      action: "post_kukai_result_or_fallback",
      targetKukaiSlot: "23:00",
      allowMeikuFallback: true,
      description: "23:00回お礼（不成立かつ当日まだ名句碑を出していなければ名句碑鑑賞）"
    },
    {
      id: "weekend_kukai_2500_result",
      time: "01:50",
      cron: "50 1 * * 0,1,6",
      action: "post_kukai_result_only_if_held",
      targetKukaiSlot: "25:00",
      allowMeikuFallback: false,
      description: "25:00回お礼（開催時のみ投稿。不成立時はスキップ）"
    }
  ]
};

/**
 * 句会終了時の投稿アクションを判定する関数
 */
export function resolveAfterKukaiAction({
  isHeld,
  kukaiSlot,
  meikuPostedTodayCount = 0,
  allowMeikuFallback = true
}) {
  if (isHeld) {
    return "thanks_held";
  }
  if (kukaiSlot === "25:00" && SCHEDULE_CONFIG.dailyLimits.skipLateNightFallback) {
    return "skip";
  }
  if (
    allowMeikuFallback &&
    meikuPostedTodayCount < SCHEDULE_CONFIG.dailyLimits.maxMeikuFallbackPerDay
  ) {
    return "meiku_monument";
  }
  return "skip";
}

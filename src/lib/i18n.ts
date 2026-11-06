import { getPrefs } from './prefs';

/** Navigation and common buttons. Page content is in Chinese for now; other strings can be added here. */
const DICT: Record<string, { en: string; ms: string }> = {
  日常工作: { en: 'Daily work', ms: 'Kerja harian' },
  资料: { en: 'Data', ms: 'Data' },
  系统: { en: 'System', ms: 'Sistem' },
  我的工作: { en: 'My work', ms: 'Kerja saya' },
  工作表看板: { en: 'Job board', ms: 'Papan kerja' },
  工作表: { en: 'Job sheets', ms: 'Helaian kerja' },
  验车服务: { en: 'Inspections', ms: 'Pemeriksaan' },
  机械租赁: { en: 'Rentals', ms: 'Sewaan' },
  交通运输: { en: 'Transport', ms: 'Pengangkutan' },
  日历: { en: 'Calendar', ms: 'Kalendar' },
  零件库: { en: 'Parts', ms: 'Alat ganti' },
  设置: { en: 'Settings', ms: 'Tetapan' },
  退出登录: { en: 'Sign out', ms: 'Log keluar' },
  搜索: { en: 'Search', ms: 'Cari' },
  新建工作表: { en: 'New job sheet', ms: 'Helaian baharu' },
  保存: { en: 'Save', ms: 'Simpan' },
  取消: { en: 'Cancel', ms: 'Batal' },
  管理员: { en: 'Admin', ms: 'Pentadbir' },
  货仓管理员: { en: 'Storekeeper', ms: 'Penjaga stor' },
  维修员: { en: 'Mechanic', ms: 'Mekanik' },
  文员: { en: 'Clerk', ms: 'Kerani' },
};
export const t = (zh: string) => {
  const lang = getPrefs().lang;
  if (lang === 'zh') return zh;
  return DICT[zh]?.[lang] ?? zh;
};

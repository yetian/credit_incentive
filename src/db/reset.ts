import fs from 'fs';
import { config } from '../config';

const targets = [config.dbPath, `${config.dbPath}-wal`, `${config.dbPath}-shm`];
let removed = 0;

for (const file of targets) {
  if (fs.existsSync(file)) {
    fs.rmSync(file);
    console.log(`[reset] 已删除 ${file}`);
    removed += 1;
  }
}

if (removed === 0) {
  console.log(`[reset] 未找到数据库文件 ${config.dbPath}，已是干净状态`);
} else {
  console.log('[reset] 数据库已清空。下次启动会重建 schema 与基础资产/徽章。运行 npm run seed 可重建示例家庭。');
}

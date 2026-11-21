import * as migration_20261026_130009 from './20261026_130009';
import * as migration_20261026_131303 from './20261026_131303';
import * as migration_20261118_155819_phase1_demo_mode from './20261118_155819_phase1_demo_mode';
import * as migration_20261118_181305_remove_legacy_sheets from './20261118_181305_remove_legacy_sheets';
import * as migration_20261121_090549_add_passport_files_and_verify_base_url from './20261121_090549_add_passport_files_and_verify_base_url';

export const migrations = [
  {
    up: migration_20261026_130009.up,
    down: migration_20261026_130009.down,
    name: '20261026_130009',
  },
  {
    up: migration_20261026_131303.up,
    down: migration_20261026_131303.down,
    name: '20261026_131303',
  },
  {
    up: migration_20261118_155819_phase1_demo_mode.up,
    down: migration_20261118_155819_phase1_demo_mode.down,
    name: '20261118_155819_phase1_demo_mode',
  },
  {
    up: migration_20261118_181305_remove_legacy_sheets.up,
    down: migration_20261118_181305_remove_legacy_sheets.down,
    name: '20261118_181305_remove_legacy_sheets',
  },
  {
    up: migration_20261121_090549_add_passport_files_and_verify_base_url.up,
    down: migration_20261121_090549_add_passport_files_and_verify_base_url.down,
    name: '20261121_090549_add_passport_files_and_verify_base_url'
  },
];

import * as migration_20261026_130009 from './20261026_130009';
import * as migration_20261026_131303 from './20261026_131303';

export const migrations = [
  {
    up: migration_20261026_130009.up,
    down: migration_20261026_130009.down,
    name: '20261026_130009',
  },
  {
    up: migration_20261026_131303.up,
    down: migration_20261026_131303.down,
    name: '20261026_131303'
  },
];

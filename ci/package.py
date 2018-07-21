import sys
from utils import execute_commands

name = 'PACKAGE'

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print('Usage: python3 package.py vx.y.z')
        exit(-1)

    versioned_dist = 'slang-ui-' + sys.argv[1].replace('.', '_')

    print(f'Step: {name}')
    execute_commands([
        'mkdir ci/release',
        f'mv dist {versioned_dist}',
        f'zip -r ci/release/{versioned_dist}.zip {versioned_dist}',
        # f'tar -zcvf ci/{versioned_dist}.zip {versioned_dist}',
    ])

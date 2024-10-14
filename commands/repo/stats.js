import { command } from 'clide-js';
import { Project, Release, Repo, sql } from '../../data/sql.js';
import updateCmd from './update.js';

const DAY_MS = 1000 * 60 * 60 * 24;
const MONTH_MS = DAY_MS * 30;

export default command({
  description: 'Get release stats for a repository',

  options: {
    owner: {
      alias: ['o'],
      description: 'The owner of the repository',
      type: 'string',
      required: true,
    },
    repo: {
      alias: ['r'],
      description: 'The repository name',
      type: 'string',
      required: true,
    },
    update: {
      alias: ['u'],
      description: 'Update the data before running',
      type: 'boolean',
      default: false,
    },
  },

  handler: async ({ client, data, options, fork }) => {
    const { owner, name } = data;
    const fullName = `${owner}/${name}`;
    const update = await options.update();

    if (update) await fork({ commands: [updateCmd] });

    // Handle missing data
    const doesExist = await Repo.findOne({ where: { owner, name } });
    if (!doesExist) {
      console.error(
        `No data found for ${fullName}. Run with --update / -u to fetch the latest.\n`
      );
      const update = await client.prompt({
        message: 'Fetch the data now?',
        type: 'toggle',
        default: false,
      });
      if (update) {
        await fork({ commands: [updateCmd] });
      } else {
        return;
      }
    }

    // const releaseStats = await Release.findAll({
    //   attributes: [
    //     ['projectId', 'id'],
    //     [sql.col('project.name'), 'name'],
    //     [
    //       sql.literal(
    //         `MAX(
    //           CASE
    //             WHEN prerelease IS NOT NULL AND prerelease != ''
    //             THEN majorVersion || "." || minorVersion || "." || patchVersion || "-" || prerelease
    //             ELSE majorVersion || "." || minorVersion || "." || patchVersion
    //           END
    //         )`
    //       ),
    //       'latest',
    //     ],
    //     [
    //       sql.literal(`julianday('now') - MAX(julianday(date))`),
    //       'daysSinceLatest',
    //     ],
    //     [
    //       sql.literal(
    //         `CAST((MAX(julianday(date)) - MIN(julianday(date))) / (COUNT(*) - 1) AS FLOAT)`
    //       ),
    //       'avgReleaseInterval',
    //     ],
    //     [
    //       sql.literal('MAX(julianday(date)) - MIN(julianday(date))'),
    //       'totalReleaseInterval',
    //     ],
    //     [
    //       sql.literal(
    //         `COUNT(CASE WHEN julianday('now') - julianday(date) <= 90 THEN 1 END)`
    //       ),
    //       'releaseCount90Days',
    //     ],
    //     [sql.literal('COUNT(*)'), 'totalReleaseCount'],
    //     [sql.literal('COUNT(DISTINCT majorVersion)'), 'majorReleaseCount'],
    //     [
    //       sql.literal('COUNT(DISTINCT majorVersion || "." || minorVersion)'),
    //       'minorReleaseCount',
    //     ],
    //     [
    //       sql.literal(
    //         'COUNT(DISTINCT majorVersion || "." || minorVersion || "." || patchVersion)'
    //       ),
    //       'patchReleaseCount',
    //     ],
    //     [
    //       sql.literal(
    //         `COUNT(DISTINCT CASE
    //           WHEN prerelease IS NOT NULL AND prerelease != ''
    //           THEN majorVersion || "." || minorVersion || "." || patchVersion || "-" || prerelease
    //           END)`
    //       ),
    //       'prereleaseCount',
    //     ],
    //   ],
    //   include: {
    //     model: Project,
    //     attributes: [],
    //   },
    //   group: ['projectId'],
    // });

    // console.log(
    //   'Release stats:',
    //   releaseStats.map((r) => r.toJSON())
    // );

    // const releasesByDate = await Release.findAll({
    //   attributes: ['id', 'version', 'date'],
    //   include: [
    //     {
    //       model: Project,
    //       attributes: [],
    //       include: [
    //         {
    //           model: Repo,
    //           attributes: [],
    //           where: { owner, name },
    //         },
    //       ],
    //     },
    //   ],
    //   order: [['date', 'DESC']],
    // });

    const releasesByDate = await Release.findAll({
      attributes: ['id', 'version', 'date'],
      include: [
        {
          model: Project,
          attributes: [],
          include: [
            {
              model: Repo,
              attributes: ['owner', 'name'],
              where: { owner, name },
              required: true,
            },
          ],
          required: true,
        },
      ],
      order: [['date', 'DESC']],
    });
    const latestRelease = releasesByDate[0];
    const daysSinceLatest = Math.floor(
      (Date.now() - latestRelease.date.getTime()) / DAY_MS
    );
    const oldestRelease = releasesByDate.at(-1);
    const daysSinceOldest = Math.floor(
      (Date.now() - oldestRelease.date.getTime()) / DAY_MS
    );
    const distinctMajorCount = new Set(
      releasesByDate.map((r) => r.majorVersion)
    );
    const distinctMinorCount = new Set(
      releasesByDate.map((r) => r.minorVersion)
    );
    const distinctPatchCount = new Set(
      releasesByDate.map((r) => r.patchVersion)
    );

    console.log('Latest release:', latestRelease.version);
    console.log('Days since latest:', daysSinceLatest);
    console.log('Days Original oldest:', daysSinceOldest);
    console.log('Distinct major versions:', distinctMajorCount.size);
    console.log('Distinct minor versions:', distinctMinorCount.size);
    console.log('Distinct patch versions:', distinctPatchCount.size);

    var dates = releasesByDate.map((r) => r.date.getTime() / DAY_MS);
    // console.log(dates);

    const gapStats = await sql.query(
      `
      SELECT
        projectId,
        p.name AS projectName,
        version,
        CAST(julianday(date) - julianday(LAG(date) OVER (PARTITION BY projectId ORDER BY date ASC)) AS INTEGER) AS daysSincePreviousRelease
      FROM
        releases r
      LEFT JOIN
        projects p ON r.projectId = p.id
      LEFT JOIN
        repos rp ON p.repoId = rp.id
      WHERE
        rp.owner = :owner
        AND rp.name = :name
      GROUP BY
        r.projectId
      ORDER BY
        r.date ASC;
      `,
      { type: sql.QueryTypes.SELECT, replacements: { owner, name } }
    );

    console.log('Gap stats:', gapStats);
    const gaps = gapStats
      .filter((r) => r.daysSincePreviousRelease !== null)
      .map((r) => r.daysSincePreviousRelease);
    console.log('Gaps:', gaps);
    // console.log(asciichart.plot(gaps, { height: 10 }));

    const projectStats = await Project.findAll({
      attributes: [
        'id',
        'name',

        [sql.fn('count', sql.col('releases.id')), 'totalReleaseCount'],
        // Count distinct major versions
        [
          sql.literal(
            `COUNT(DISTINCT SUBSTR(version, 1, INSTR(version, '.') - 1))`
          ),
          'distinctMajorCount',
        ],

        // Count distinct minor versions
        [
          sql.literal(
            `COUNT(
              DISTINCT SUBSTR(
                version,
                INSTR(version, '.') + 1,
                INSTR(
                  SUBSTR(
                    version,
                    INSTR(version, '.') + 1
                  ),
                  '.'
                ) - 1
              )
            )`
          ),
          'distinctMinorCount',
        ],

        // Count distinct patch versions
        [
          sql.fn(
            'SUM',
            sql.literal(`CASE WHEN version NOT LIKE '%-%' THEN 1 ELSE 0 END`)
          ),
          'distinctPatchCount',
        ],
      ],
      include: [
        {
          model: Release,
          attributes: [],
        },
        {
          model: Repo,
          attributes: [],
          where: { owner, name },
        },
      ],
      group: sql.col('project.id'),
    });

    console.log(
      'Project stats:',
      projectStats.map((r) => r.toJSON())
      // JSON.stringify(
      //   projectStats.map((r) => r.toJSON()),
      //   null,
      //   2
      // )
    );

    // Average major release interval
  },
});

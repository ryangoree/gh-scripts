import { dirname, resolve } from 'node:path';
import { major, minor, patch, prerelease } from 'semver';
import { DataTypes, Sequelize } from 'sequelize';

const basePath = dirname(new URL(import.meta.url).pathname);

export const sql = new Sequelize({
  dialect: 'sqlite',
  storage: resolve(basePath, 'db.sqlite'),
  logging: false,
});

// Models //

export const Repo = sql.define(
  'repo',
  {
    name: DataTypes.TEXT,
    owner: DataTypes.TEXT,
  },
  {
    indexes: [
      {
        unique: true,
        fields: ['name', 'owner'],
      },
    ],
  }
);

export const Project = sql.define(
  'project',
  {
    name: DataTypes.TEXT,
  },
  {
    indexes: [
      { fields: ['repoId'] },
      { unique: true, fields: ['repoId', 'name'] },
    ],
  }
);
Project.belongsTo(Repo);
Repo.hasMany(Project);

export const Release = sql.define(
  'release',
  {
    version: DataTypes.TEXT,
    date: DataTypes.DATE,
    tag: DataTypes.TEXT,
    url: DataTypes.TEXT,
    majorVersion: {
      type: DataTypes.VIRTUAL,
      get() {
        return major(this.version);
      },
    },
    minorVersion: {
      type: DataTypes.VIRTUAL,
      get() {
        return minor(this.version);
      },
    },
    patchVersion: {
      type: DataTypes.VIRTUAL,
      get() {
        return patch(this.version);
      },
    },
    prerelease: {
      type: DataTypes.VIRTUAL,
      get() {
        return prerelease(this.version);
      },
    },
  },
  {
    indexes: [
      { fields: ['date'] },
      { fields: ['projectId'] },
      {
        unique: true,
        fields: ['projectId', 'tag'],
      },
    ],
  }
);
Release.belongsTo(Project);
Project.hasMany(Release);

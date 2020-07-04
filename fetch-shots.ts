import { promises as fsp } from 'fs';
import * as fs from 'fs';

const rmfr = require('rmfr');
const captureWebsite = require('capture-website');
import { ncp } from 'ncp';

export const shotsFolder = 'screenshots';
export const outBaseFolder = __dirname + '/dist'
export const outImageFolder = outBaseFolder + '/' + shotsFolder;
const imagesFilter = outImageFolder + '/*.png';
export const dataFile = __dirname + '/sites.json';
export const srcFolder = __dirname + '/src';


const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;

function linkify(text) {

  return text.replace(urlRegex, function (url) {
    return '<a href="' + url + '">' + url + '</a>';
  });
}

function findAll(reg: RegExp, text: string) {
  const matches = [];
  let found;
  while (found = reg.exec(text)) {
    matches.push(found[0]);
    reg.lastIndex -= found[0].split(':')[1].length;
  }
  return matches;
}

export function urlToFname(url: string) {
  return url.replace(/https?:/g, '').replace(/\//g, '') + '.png';
}

export async function readJson(filePath: string) {
  return JSON.parse(await fsp.readFile(filePath, 'utf8'))
}

function checkFileExists(filepath){
  return new Promise((resolve, reject) => {
    fs.access(filepath, fs.constants.F_OK, error => {
      resolve(!error);
    });
  });
}

async function copyDir(source: string, destination: string) {
  return new Promise((resolve, reject) => {
    ncp(source, destination, function (err: Error) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function setupFolder() {
  // Delete existing images
  // await rmfr(imagesFilter, { glob: true });

  // Make sure screenshots directory exists
  if (!await checkFileExists(outImageFolder)) {
    await fsp.mkdir(outImageFolder, { recursive: true });
  }

  return copyDir(srcFolder, outBaseFolder);
}

async function main() {
  await setupFolder();

  const entries = await readJson(dataFile);

  let promises = [];
  // maxParallelScreenshots set to something less than the default node
  // listener limit (15?)
  const maxParallelScreenshots = 6;
  for (const entry of entries) {
    if (promises.length >= maxParallelScreenshots) {
      // limit parallelism
      await Promise.all(promises);
      promises = [];
    }
    // console.log(line);
    const url = entry.url;
    console.log(url);

    // if (url.indexOf('github.com') >= 0) {
    //   console.log("skipping github.com");
    //   continue
    // }
    const fname = urlToFname(url);
    const dest = `${outImageFolder}/${fname}`;
    const fetchPromise = captureWebsite.file(url, dest, {
      width: 800,
      height: 1000,
      scaleFactor: 1,
      delay: 5, // seconds delay for the shot because sometimes the red map fails to load
      timeout: 30, // default of 60 is way too long.
    });
    fetchPromise.catch((err) => {
      console.error(`Failed on: ${url}`);
    })
    promises.push(fetchPromise);
    console.log("promised", dest);
  }
  await Promise.all(promises);
  console.log("done");
};

if (typeof require !== 'undefined' && require.main === module) {
  main()
    .catch((err) => { console.error("unhandled fail", __filename, err) })
    .then(() => { console.log("done with", __filename); });
}

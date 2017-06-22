/**
 * A set of functions that can be deployed to transcribe audio files to speech
 *
 * Note: these examples are overly verbose for demonstration purposes.
 * A real application should not use console.log this liberally.
 */

'use strict';

const storage = require('@google-cloud/storage');
const speech = require('@google-cloud/speech')();

/**
 * Handles changes to a cloud storage bucket item.
 *
 * @param {object} event The event that triggered this function
 * @returns {Promise}
 */
exports.storageHandler = (event) => {
  const obj = event.data;
  console.log('Handling event for object:', obj);

  if (obj.resourceState === 'not_exists') {
    console.log('Object has been deleted, nothing to do:', obj.name);
    return Promise.resolve();
  }

  if (!obj.bucket) {
    throw new Error('Bucket is missing from event data');
  }
  if (!obj.name) {
    throw new Error('Object name is missing from event data');
  }

  const uri = 'gs://' + obj.bucket + '/' + obj.name;
  const meta = obj.metadata || {};

  // Use object metadata to specify language and audio encoding parameters
  // Note: gsutil often removes camelCase from meta parameters during upload
  // so check languageCode and languagecode
  const language = meta.languageCode || meta.languagecode || obj.contentLanguage || 'en-US';
  const sampleRate = parseInt(meta.sampleRateHertz || meta.sampleratehertz || '16000');
  const encoding = meta.encoding || 'LINEAR16';
  const params = {
    encoding: encoding,
    languageCode: language,
    sampleRateHertz: sampleRate
  };
  return processStorageObject(uri, params)
    .then((transcript) => {
      console.log('Transcript:', transcript);
    });
};

/**
 * Given an uri for an object in Cloud Storage, and any known parameters, invoke
 * the Cloud Speech API and transcribe the audio.
 *
 * @param {string} uri The URI of object in Cloud Storage; e.g. gs://bucket/name
 * @param {object} params A set of parameters to use when trying to transcribe audio.
 * @returns {Promise} A promise that encapsulates the transcribed audio
 */
function processStorageObject(uri, params) {
  console.log('Handling storage bucket object, uri:', uri, 'with params:', params);
  const apiParams = Object.create(params);
  apiParams.verbose = true;
  apiParams.maxAlternatives = 1;
  return speech.startRecognition(uri, apiParams)
    .then((data) => {
      console.log('Start recognition returned:', data);
      const operation = data[0];
      // Return a promise to get the results when complete
      return operation.promise();
    })
    .then((data) => {
      console.log('Operation has finished:', data);
      return data[0]
        .map((result) => result.transcript)
        .reduce((accumulator, element) => '' + accumulator + element, '');
    });
};

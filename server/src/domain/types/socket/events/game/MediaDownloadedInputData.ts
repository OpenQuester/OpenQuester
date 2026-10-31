export interface MediaDurationReport {
  /** File md5 from questionFiles */
  md5: string;
  /** Real play length of the audio/video in milliseconds */
  durationMs: number;
}

/**
 * Optional payload of the media-downloaded acknowledgement. Clients that can
 * read media metadata report real audio/video lengths so the server can time
 * the content timeline; older clients send nothing.
 */
export interface MediaDownloadedInputData {
  mediaDurations?: MediaDurationReport[];
  mediaPreparationId?: string;
}

export interface S3Context {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
  urlPrefix: string;
  useSubDomainBucketFormat: boolean;
}

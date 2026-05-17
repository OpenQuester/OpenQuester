import Joi from "joi";

import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ServerResponse } from "domain/enums/ServerResponse";
import { ClientError } from "domain/errors/ClientError";
import { ServerError } from "domain/errors/ServerError";

export class SchemaValidator<T> {
  private readonly schema: Joi.ObjectSchema<T>;
  private readonly data: T;

  constructor(data: T, schema: Joi.ObjectSchema<T>) {
    this.schema = schema;
    this.data = data;
  }

  public validate(): T {
    if (!this.schema) {
      throw new ServerError(ServerResponse.NO_SCHEMA);
    }

    const { value, error } = this.schema.validate(this.data, {
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      throw new ClientError(ClientResponse.VALIDATION_ERROR, HttpStatus.BAD_REQUEST, {
        error
      });
    }

    return value;
  }
}

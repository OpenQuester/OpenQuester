import { type EOauthProvider } from "domain/types/dto/auth/Oauth2LoginDTO";

/** One sign-in provider the server has set up */
export interface OauthProviderSettingsDTO {
  provider: EOauthProvider;
  /** Public application id the client starts the provider's sign-in with */
  clientId: string;
}

/** Public sign-in settings the clients read at runtime */
export interface AuthSettingsDTO {
  /** Providers that are set up; one that isn't is left out */
  oauthProviders: OauthProviderSettingsDTO[];
}

export const LICENSE_PORTAL_JWT_AUD = 'license-portal' as const;

export type PortalJwtPayload = {
  sub: string;
  aud: typeof LICENSE_PORTAL_JWT_AUD;
  username: string;
};

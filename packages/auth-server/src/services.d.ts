declare module '@elkdonis/services' {
  export type NextcloudProvisioningResult = { success: boolean; error?: string };

  export function handleUserProvisioning(
    userId: string,
    email: string,
    displayName: string,
    options?: { groups?: string[] }
  ): Promise<NextcloudProvisioningResult>;
}

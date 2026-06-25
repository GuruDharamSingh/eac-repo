/**
 * POST /api/auth/provision-nextcloud
 *
 * Provisions the signed-in user's Nextcloud account (idempotent). Needed for
 * OAuth signups, which bypass the email/password signup path where
 * NEXTCLOUD_AUTO_PROVISION runs. The Silex token route also provisions
 * lazily, so this endpoint is for explicit "connect my account" flows.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
import { handleUserProvisioning } from "@elkdonis/services";

export async function POST() {
  try {
    const session = await getServerSession();
    if (!session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user } = session;

    if (user.nextcloud_user_id && user.nextcloud_app_password) {
      return NextResponse.json({
        success: true,
        message: "User already provisioned",
        nextcloudUserId: user.nextcloud_user_id,
      });
    }

    const displayName = user.email?.split("@")[0] || "User";
    const result = await handleUserProvisioning(
      user.db_user_id ?? user.id,
      user.email!,
      displayName,
      { groups: [process.env.NEXTCLOUD_DEFAULT_GROUP || "EAC_Network"] }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Provisioning failed" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      nextcloudUserId: result.nextcloudUserId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

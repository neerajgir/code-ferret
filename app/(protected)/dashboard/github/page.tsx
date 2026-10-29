import { requiredAuth } from '@/features/auth/actions';
import { DashboardHeader } from '@/features/dashboard/components/dashboard-header';
import { GithubConnectCard } from '@/features/github/components/github-connect-card';
import { getInstallationStatus } from '@/features/github/server/installation';
import { Metadata } from 'next';
import React from 'react'

export const metadata: Metadata = {
  title: "Github App - Dashboard"
}

const DashboardGithubPage = async () => {
  const session = await requiredAuth();
  const installation = await getInstallationStatus(session.user.id);
  return (
    <div>
      <DashboardHeader
      title="Github App"
      description="Install or Disconnect the reviewer app from you github account"
      />
      <GithubConnectCard userId={session.user.id} installation={installation}/>
    </div>
  )
}

export default DashboardGithubPage
import { redirect } from 'next/navigation';
import { getProjects } from '@/app/actions/projects';
import WelcomeWizard from '@/components/WelcomeWizard';

export default async function Home() {
  try {
    // Check if there are any projects instead of checking database initialization
    const projects = await getProjects();
    
    if (projects && projects.length > 0) {
      redirect('/mcp-servers');
    }

    return <WelcomeWizard />;
  } catch (error) {
    console.error('Error in Home page:', error);
    // Always show the welcome wizard if there's an error
    return <WelcomeWizard />;
  }
}
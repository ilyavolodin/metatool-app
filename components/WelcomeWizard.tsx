'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createProject } from '@/app/actions/projects';

export default function WelcomeWizard() {
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!projectName.trim()) {
      setError('Project name cannot be empty.');
      setLoading(false);
      return;
    }

    try {
      const newProject = await createProject(projectName);
      if (newProject) {
        router.push('/mcp-servers'); // Redirect to dashboard after setup
      } else {
        setError('Failed to create project. Please try again.');
      }
    } catch (err) {
      console.error('Project creation error:', err);
      setError('An unexpected error occurred during project creation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold">Welcome to Metatool!</h1>
        <p className="mb-4 text-center text-gray-600">
          It looks like this is your first time running the application or the database is not initialized.
          Let&apos;s get you set up by creating your first project.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="projectName" className="mb-2 block text-sm font-medium text-gray-700">
              Project Name
            </label>
            <input
              type="text"
              id="projectName"
              className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., My First Project"
              required
              disabled={loading}
            />
          </div>
          {error && <p className="mb-4 text-center text-red-500">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Setting up...' : 'Create Project and Get Started'}
          </button>
        </form>
      </div>
    </div>
  );
}

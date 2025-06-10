'use client';

import {
  FileText,
  Info,
  Key,
  Search,
  Server,
  Settings,
  Terminal,
  Wrench,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';

import { ProfileSwitcher } from './profile-switcher';
import { ProjectSwitcher } from './project-switcher';

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {


  return (
    <SidebarProvider>
      <div className='flex flex-1 h-screen'>
        {/* Main Sidebar */}
        <Sidebar collapsible='none' className='w-64 flex-shrink-0 border-r'>
          <SidebarHeader className='flex flex-col justify-center items-center px-2 py-4'>
            <div className='flex items-center gap-4 mb-2'>
              <Image
                src='/favicon.ico'
                alt='MetaMCP Logo'
                width={256}
                height={256}
                className='h-12 w-12'
              />
              <h2 className='text-2xl font-semibold'>MetaMCP</h2>
            </div>
            <ProjectSwitcher />
            <ProfileSwitcher />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href='/setup-guide'>
                        <Info className='mr-2 h-4 w-4' />
                        <span>Setup Guide</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href='/search'>
                        <Search className='mr-2 h-4 w-4' />
                        <span>Explore & Search (Beta)</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href='/mcp-servers'>
                        <Server className='mr-2 h-4 w-4' />
                        <span>MCP Servers</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href='/tool-management'>
                        <Wrench className='mr-2 h-4 w-4' />
                        <span>Tool Management</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href='/tool-execution-logs'>
                        <FileText className='mr-2 h-4 w-4' />
                        <span>Tool Execution Logs</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {/* <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href='/custom-mcp-servers'>
                        <Wrench className='mr-2 h-4 w-4' />
                        <span>Custom MCP Servers</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem> */}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href='/api-keys'>
                        <Key className='mr-2 h-4 w-4' />
                        <span>API Keys</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href='/inspector-guide'>
                        <Terminal className='mr-2 h-4 w-4' />
                        <span>Inspector Guide</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href='/settings'>
                        <Settings className='mr-2 h-4 w-4' />
                        <span>Settings</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>


        {/* Main Content Area */}
        <SidebarInset className='flex-grow'>
          <main className='h-full overflow-auto'>{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

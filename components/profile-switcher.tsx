'use client';

import { Check, ChevronsUpDown, PlusCircle } from 'lucide-react';
import { Check, ChevronsUpDown, PlusCircle } from 'lucide-react'; // Explicitly removed Info
import * as React from 'react';

import { createProfile, setProfileActive } from '@/app/actions/profiles';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
// import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'; // Removed
// import {
//   Tooltip,
//   TooltipContent,
//   TooltipProvider,
//   TooltipTrigger,
// } from '@/components/ui/tooltip'; // Removed
// import { WorkspaceMode } from '@/db/schema'; // Removed
import { useProfiles } from '@/hooks/use-profiles';
import { useProjects } from '@/hooks/use-projects';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function ProfileSwitcher() {
  const { currentProject } = useProjects();
  const {
    profiles,
    currentProfile,
    setCurrentProfile,
    activeProfile,
    mutateProfiles,
    mutateActiveProfile,
  } = useProfiles();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [showNewProfileDialog, setShowNewProfileDialog] = React.useState(false);
  const [newProfileName, setNewProfileName] = React.useState('');
  // const [profileMode, setProfileMode] = React.useState('default'); // Removed
  const [isCreating, setIsCreating] = React.useState(false);
  const [isActivating, setIsActivating] = React.useState(false);

  async function handleCreateProfile() {
    if (!newProfileName.trim()) {
      toast({
        title: 'Error',
        description: 'Profile name cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (!currentProject?.uuid) {
        return;
      }
      setIsCreating(true);
      // createProfile action no longer takes profileMode
      const profile = await createProfile(
        currentProject.uuid,
        newProfileName.trim()
      );
      setCurrentProfile(profile);
      setNewProfileName('');
      // setProfileMode('default'); // Removed
      setShowNewProfileDialog(false);
      toast({
        title: 'Success',
        description: 'Profile created successfully',
      });
      mutateProfiles();
    } catch (error) {
      console.error('Failed to create workspace:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create workspace',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className='flex flex-col gap-2 w-full p-2'>
      <div>
        <p className='text-xs font-medium p-1'>Workspaces</p>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant='outline'
              role='combobox'
              aria-expanded={open}
              aria-label='Select a profile'
              className='w-full justify-between'>
              {currentProfile?.name ?? 'Loading Profiles...'}
              <ChevronsUpDown className='ml-auto h-4 w-4 shrink-0 opacity-50' />
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-[--radix-popover-trigger-width] p-0'>
            <Command>
              <CommandList>
                <CommandInput placeholder='Search profiles...' />
                <CommandEmpty>No profile found.</CommandEmpty>
                <CommandGroup heading='Workspaces'>
                  {profiles?.map((profile) => (
                    <CommandItem
                      key={profile.uuid}
                      onSelect={() => {
                        setCurrentProfile(profile);
                        setOpen(false);
                        window.location.reload();
                      }}
                      className='text-sm'>
                      {profile.name}
                      <Check
                        className={cn(
                          'ml-auto h-4 w-4',
                          currentProfile?.uuid === profile.uuid
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
              <CommandSeparator />
              <CommandList>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      setShowNewProfileDialog(true);
                    }}>
                    <PlusCircle className='mr-2 h-5 w-5' />
                    Create Workspace
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <Button
        onClick={() => {
          if (!currentProject || !currentProfile) return;
          setIsActivating(true);
          setProfileActive(currentProject.uuid, currentProfile.uuid).finally(
            () => {
              mutateActiveProfile();
              setIsActivating(false);
            }
          );
        }}
        disabled={
          !currentProject ||
          !currentProfile ||
          currentProfile.uuid === activeProfile?.uuid
        }>
        {!currentProject || !currentProfile
          ? 'Loading...'
          : currentProfile.uuid === activeProfile?.uuid
            ? 'Workspace activated'
            : isActivating
              ? 'Activating...'
              : 'Activate this Workspace'}
      </Button>
      {/* Removed WorkspaceMode display */}
      <Dialog
        open={showNewProfileDialog}
        onOpenChange={setShowNewProfileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
            <DialogDescription>
              Add a new profile to your project.
            </DialogDescription>
          </DialogHeader>
          <div>
            <div className='space-y-4 py-2 pb-4'>
              <div className='space-y-2'>
                <Label htmlFor='name'>Workspace name</Label>
                <Input
                  id='name'
                  placeholder='Enter workspace name'
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                />
              </div>
              {/* Removed Workspace Mode selection RadioGroup */}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowNewProfileDialog(false)}>
              Cancel
            </Button>
            <Button disabled={isCreating} onClick={handleCreateProfile}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

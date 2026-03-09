/**
 * PaleoClaw Profile CLI
 * Commands: init, show
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ensureProfileLayers,
  loadSessionProfile,
  DEFAULT_SOUL_TEMPLATE,
  DEFAULT_USER_TEMPLATE,
} from '../profile/layers.js';

interface ProfileCommandOptions {
  json?: boolean;
}

function paleoclawHome(): string {
  return process.env.PALEOCLAW_HOME || path.join(os.homedir(), '.paleoclaw');
}

export function registerProfileCommands(program: any): void {
  const profileCmd = program
    .command('profile')
    .description('Manage PaleoClaw Soul/User profile layers');

  // init command
  profileCmd
    .command('init')
    .description('Initialize soul.md and user.md in ~/.paleoclaw/')
    .option('--json', 'Output as JSON')
    .action(async (options: ProfileCommandOptions) => {
      try {
        const paths = ensureProfileLayers();
        
        const result = {
          status: 'initialized',
          paths: {
            soul: paths.homeSoul,
            user: paths.homeUser,
          },
          message: 'Profile layers initialized successfully',
        };

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('✓ Profile layers initialized');
          console.log(`  Soul:  ${paths.homeSoul}`);
          console.log(`  User:  ${paths.homeUser}`);
          console.log('');
          console.log('Edit these files to customize PaleoClaw behavior:');
          console.log('  - soul.md: System identity and scientific principles');
          console.log('  - user.md: Personal research preferences');
        }
      } catch (error) {
        console.error('Error initializing profile:', error);
        process.exit(1);
      }
    });

  // show command
  profileCmd
    .command('show')
    .description('Display current profile configuration')
    .option('--json', 'Output as JSON')
    .action(async (options: ProfileCommandOptions) => {
      try {
        const profile = loadSessionProfile(undefined, true);
        
        if (options.json) {
          const output = {
            loadedAt: profile.loadedAt,
            soulPath: profile.soulPath,
            userPath: profile.userPath,
            soul: {
              identity: profile.soul.identity.slice(0, 100) + '...',
              mission: profile.soul.mission,
              corePrinciples: profile.soul.corePrinciples.slice(0, 5),
              dataSourceHierarchy: profile.soul.dataSourceHierarchy.slice(0, 5),
              safetyBoundaries: profile.soul.safetyBoundaries.slice(0, 5),
            },
            user: {
              role: profile.user.role,
              domain: profile.user.domain,
              institution: profile.user.institution,
              researchFocus: profile.user.researchFocus,
              languagePreference: profile.user.languagePreference,
              outputLanguage: profile.user.outputLanguage,
              preferredJournals: profile.user.preferredJournals.slice(0, 5),
            },
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          console.log('╔════════════════════════════════════════════════════════════╗');
          console.log('║              PaleoClaw Profile Configuration               ║');
          console.log('╚════════════════════════════════════════════════════════════╝');
          console.log('');
          
          console.log('📁 Profile Files:');
          console.log(`   Soul: ${profile.soulPath}`);
          console.log(`   User: ${profile.userPath}`);
          console.log(`   Loaded: ${profile.loadedAt}`);
          console.log('');
          
          console.log('🧬 Soul Configuration:');
          console.log(`   Identity: ${profile.soul.identity.slice(0, 60)}...`);
          console.log(`   Mission: ${profile.soul.mission.slice(0, 60)}...`);
          console.log(`   Core Principles: ${profile.soul.corePrinciples.length} items`);
          console.log(`   Data Sources: ${profile.soul.dataSourceHierarchy.length} sources`);
          console.log(`   Safety Boundaries: ${profile.soul.safetyBoundaries.length} rules`);
          console.log('');
          
          console.log('👤 User Configuration:');
          console.log(`   Role: ${profile.user.role}`);
          console.log(`   Domain: ${profile.user.domain}`);
          if (profile.user.institution) {
            console.log(`   Institution: ${profile.user.institution}`);
          }
          console.log(`   Language: ${profile.user.languagePreference}`);
          console.log(`   Output: ${profile.user.outputLanguage}`);
          console.log('');
          
          console.log('🔬 Research Focus:');
          console.log(`   Interests: ${profile.user.researchFocus.primaryInterests.slice(0, 3).join(', ')}${profile.user.researchFocus.primaryInterests.length > 3 ? '...' : ''}`);
          console.log(`   Periods: ${profile.user.researchFocus.preferredPeriods.slice(0, 3).join(', ')}`);
          console.log(`   Regions: ${profile.user.researchFocus.preferredRegions.slice(0, 3).join(', ')}${profile.user.researchFocus.preferredRegions.length > 3 ? '...' : ''}`);
          console.log('');
          
          console.log('📚 Preferences:');
          console.log(`   Journals: ${profile.user.preferredJournals.slice(0, 3).join(', ')}${profile.user.preferredJournals.length > 3 ? '...' : ''}`);
          console.log(`   Citation Format: ${profile.user.dataPreferences.citationFormat}`);
          console.log(`   Default Limit: ${profile.user.dataPreferences.defaultOccurrenceLimit}`);
          console.log(`   Open Access: ${profile.user.dataPreferences.preferOpenAccess ? 'Yes' : 'No'}`);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        process.exit(1);
      }
    });
}

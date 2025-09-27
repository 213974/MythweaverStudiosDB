// src/handlers/interactions/adminPanel/clanHandler.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, RoleSelectMenuBuilder, UserSelectMenuBuilder } = require('discord.js');
const { createClanDashboard } = require('../../../components/adminDashboard/clanPanel');
const clanManager = require('../../../utils/clanManager');
const { parseUser, parseRole } = require('../../../utils/interactionHelpers');

module.exports = async (interaction) => {
    const customId = interaction.customId;

    // --- BUTTON CLICKS ---
    if (interaction.isButton()) {
        const action = customId.split('_')[2];

        // --- Start of Create Clan Flow ---
        if (action === 'create') {
            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle('Clan Creation: Step 1 of 2')
                .setDescription('Please select the Discord role that will represent this new clan.');
            
            const roleSelect = new RoleSelectMenuBuilder()
                .setCustomId('admin_clan_create_role_select')
                .setPlaceholder('Select a role...');
            
            const cancel = new ButtonBuilder()
                .setCustomId('admin_clan_nav')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary);

            const row1 = new ActionRowBuilder().addComponents(roleSelect);
            const row2 = new ActionRowBuilder().addComponents(cancel);

            return interaction.update({ embeds: [embed], components: [row1, row2] });
        }
        
        // --- Navigation Buttons ---
        if (customId === 'admin_clan_nav') {
            const response = createClanDashboard();
            return interaction.update({ ...response });
        }

        // --- Legacy Modal Buttons (Delete/Owner) ---
        let modal;
        if (action === 'delete') {
            modal = new ModalBuilder().setCustomId('admin_clan_modal_delete').setTitle('Delete a Clan');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_input').setLabel("Clan Role (@Mention or ID)").setStyle(TextInputStyle.Short).setRequired(true)));
        } else if (action === 'owner') {
            modal = new ModalBuilder().setCustomId('admin_clan_modal_owner').setTitle('Change Clan Ownership');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_input').setLabel("Clan Role (@Mention or ID)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('owner_input').setLabel("New Clan Owner (@Mention or ID)").setStyle(TextInputStyle.Short).setRequired(true))
            );
        }
        if (modal) return interaction.showModal(modal);
    }

    // --- ROLE SELECT (Create Clan Step 2) ---
    if (interaction.isRoleSelectMenu() && customId === 'admin_clan_create_role_select') {
        const roleId = interaction.values[0];
        const role = await interaction.guild.roles.fetch(roleId);

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('Clan Creation: Step 2 of 2')
            .setDescription(`**Clan Role:** ${role}\n\nPlease now select the user who will be the owner of this clan.`);

        const userSelect = new UserSelectMenuBuilder()
            .setCustomId(`admin_clan_create_owner_select_${roleId}`) // Pass roleId in customId
            .setPlaceholder('Select a user...');
        
        const cancel = new ButtonBuilder()
            .setCustomId('admin_clan_nav')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);
        
        const row1 = new ActionRowBuilder().addComponents(userSelect);
        const row2 = new ActionRowBuilder().addComponents(cancel);
        
        return interaction.update({ embeds: [embed], components: [row1, row2] });
    }

    // --- USER SELECT (Create Clan Final Step) ---
    if (interaction.isUserSelectMenu() && customId.startsWith('admin_clan_create_owner_select_')) {
        const roleId = customId.split('_')[5];
        const ownerId = interaction.values[0];
        const role = await interaction.guild.roles.fetch(roleId);
        const owner = await interaction.guild.members.fetch(ownerId);

        const result = clanManager.createClan(interaction.guild.id, roleId, ownerId);

        let embed;
        if (result.success) {
            embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('✅ Clan Created Successfully')
                .setDescription(`**Clan:** ${role}\n**Owner:** ${owner}`);
        } else {
            embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ Clan Creation Failed')
                .setDescription(result.message);
        }
        
        const backButton = new ButtonBuilder().setCustomId('admin_clan_nav').setLabel('Back to Clan Menu').setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(backButton);

        return interaction.update({ embeds: [embed], components: [row] });
    }

    // --- MODAL SUBMISSIONS (Legacy Delete/Owner) ---
    if (interaction.isModalSubmit()) {
        await interaction.deferReply({ flags: 64 });
        const action = customId.split('_')[3];
        const clanRole = await parseRole(interaction.guild, interaction.fields.getTextInputValue('role_input'));
        if (!clanRole) return interaction.editReply({ content: 'Error: Invalid Clan Role provided.' });

        if (action === 'delete') {
            const result = clanManager.deleteClan(interaction.guild.id, clanRole.id);
            if (result.success) await interaction.editReply({ content: `Successfully deleted clan **${clanRole.name}**.` });
            else await interaction.editReply({ content: `Failed to delete clan: ${result.message}` });
        } else if (action === 'owner') {
            const newOwner = await parseUser(interaction.guild, interaction.fields.getTextInputValue('owner_input'));
            if (!newOwner) return interaction.editReply({ content: 'Error: Invalid New Owner provided.' });
            const result = clanManager.setClanOwner(interaction.guild.id, clanRole.id, newOwner.id);
            if (result.success) await interaction.editReply({ content: `Successfully transferred ownership of **${clanRole.name}** to ${newOwner}.` });
            else await interaction.editReply({ content: `Failed to transfer ownership: ${result.message}` });
        }
    }
    
    // Fallback for main select menu
    if (interaction.isStringSelectMenu() && customId === 'admin_panel_select') {
        const response = createClanDashboard();
        return interaction.reply({ ...response, flags: 64 });
    }
};
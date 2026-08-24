import { createClient } from "@supabase/supabase-js";
import { vault } from "./backend/db/vault";

const supabase = createClient(vault.supabaseUrl, vault.supabaseKey);

async function main() {
    const projectId = "d66785f9-aa8d-463e-9646-d9f384df3f7b";
    const serviceId = "d065d9c4-fcb8-47cb-88f8-2b857150b421";
    const targetChat = "38.7.53.172";

    // 1. Get the assistant prompt
    const { data: promptSetting, error: promptErr } = await supabase
        .from('settings')
        .select('*')
        .eq('project_id', projectId)
        .eq('service_id', serviceId)
        .eq('key', 'ASSISTANT_PROMPT')
        .maybeSingle();

    if (promptErr) {
        console.error("Error loading prompt:", promptErr);
    } else {
        console.log("=== ASSISTANT PROMPT ===");
        console.log(promptSetting?.value);
        console.log("========================\n");
    }

    // 2. Query chats containing the search term
    const { data: chats, error: chatErr } = await supabase
        .from('chats')
        .select('*')
        .eq('project_id', projectId)
        .ilike('id', `%${targetChat}%`);

    if (chatErr) {
        console.error("Error querying chats:", chatErr);
    } else {
        console.log("=== MATCHING CHATS ===");
        chats.forEach(c => {
            console.log(`ID: ${c.id} | Name: ${c.name} | Cuit/Dni: ${c.cuit_dni} | Assigned to: ${c.assigned_to} | Metadata:`, JSON.stringify(c.metadata));
        });
    }

    // 3. Query messages for those chats
    if (chats && chats.length > 0) {
        for (const chat of chats) {
            const { data: messages, error: msgErr } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', chat.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (msgErr) {
                console.error(`Error querying messages for chat ${chat.id}:`, msgErr);
            } else {
                console.log(`\n=== LAST 10 MESSAGES FOR CHAT ${chat.id} ===`);
                messages.reverse().forEach(m => {
                    console.log(`[${m.role}] [${m.created_at}] - ${m.content}`);
                });
            }
        }
    }
}

main();

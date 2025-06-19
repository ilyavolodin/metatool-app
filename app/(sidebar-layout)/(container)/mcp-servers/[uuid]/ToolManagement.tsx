import { ClientRequest, ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { RefreshCw } from "lucide-react"; // Removed Copy
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { z } from "zod";

import { getToolsByMcpServerUuid, saveToolsToDatabase } from "@/app/actions/tools";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// Removed Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
import { McpServerType } from "@/db/schema";
// import { useProfiles } from "@/hooks/use-profiles";
import { useToast } from "@/hooks/use-toast";
import * as logger from "@/lib/logger";

import ToolsList from "./ToolsList";


interface ToolManagementProps {
    mcpServer: {
        uuid: string;
        type: McpServerType;
    };
    hasToolsManagement: boolean;
    // apiKey?: { // apiKey prop removed
    //     api_key: string;
    // } | null;
    makeRequest: (request: ClientRequest, schema: z.ZodType) => Promise<any>;
}

export default function ToolManagement({ mcpServer, hasToolsManagement, /* apiKey, */ makeRequest }: ToolManagementProps) { // apiKey destructured but commented
    const router = useRouter();
    const { toast } = useToast();
    const { mutate: mutateTools } = useSWR(
        mcpServer.uuid ? ['getToolsByMcpServerUuid', mcpServer.uuid] : null,
        () => getToolsByMcpServerUuid(mcpServer.uuid)
    );

    // const { currentProfile } = useProfiles(); // Removed if not used elsewhere in this component
    // const currentProfileMode = currentProfile?.workspace_mode; // Removed

    // Add missing state definitions
    // eslint-disable-next-line unused-imports/no-unused-vars
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Add clearError function
    const clearError = (key: keyof typeof errors) => {
        setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[key];
            return newErrors;
        });
    };

    const sendMCPRequest = async <T extends z.ZodType>(
        request: ClientRequest,
        schema: T,
        tabKey?: keyof typeof errors,
    ) => {
        try {
            const response = await makeRequest(request, schema);
            if (tabKey !== undefined) {
                clearError(tabKey);
            }
            return response;
        } catch (e) {
            const errorString = (e as Error).message ?? String(e);
            if (tabKey !== undefined) {
                setErrors((prev) => ({
                    ...prev,
                    [tabKey]: errorString,
                }));
            }
            throw e;
        }
    };

    if (!hasToolsManagement) {
        return (
            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Tool Management</CardTitle>
                    <CardDescription>
                        Tool management is currently disabled. To enable this feature and manage tools for your MCP servers, please visit the Tool Management tab in your profile settings.
                    </CardDescription>
                    <Button
                        variant="outline"
                        className="mt-4 w-fit"
                        onClick={() => router.push('/tool-management')}
                    >
                        Go to Tool Management
                    </Button>
                </CardHeader>
            </Card>
        );
    }

    return (
        <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Tools</h2>
                {/* Simplified refresh button logic - always use sendMCPRequest */}
                <Button size="sm" onClick={async () => {
                    try {
                        const response = await sendMCPRequest(
                            {
                                method: "tools/list" as const,
                                params: {}
                            },
                            ListToolsResultSchema,
                            "tools"
                        );

                        if (response.tools.length > 0) {
                            await saveToolsToDatabase(mcpServer.uuid, response.tools);
                            await mutateTools();

                            toast({
                                description: `${response.tools.length} tools refreshed successfully`
                            });
                        } else {
                            toast({
                                description: "No tools found to refresh"
                            });
                        }
                    } catch (error) {
                        logger.error("Error refreshing tools:", error);
                        toast({
                            variant: "destructive",
                            title: "Error refreshing tools",
                            description: error instanceof Error ? error.message : "An unknown error occurred"
                        });
                    }
                }}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>
            <ToolsList mcpServerUuid={mcpServer.uuid} />
        </div>
    );
} 
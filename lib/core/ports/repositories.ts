import type { Artifact } from "../artifacts/contracts";
import type { AuditEvent } from "../audit/contracts";
import type { Conversation } from "../conversations/contracts";
import type { FileAsset } from "../files/contracts";
import type { OwnershipContext } from "../identity/contracts";
import type { Message } from "../messages/contracts";
import type { Project } from "../projects/contracts";
import type { AgentRun } from "../runs/contracts";
import type { ArtifactId, ConversationId, FileId, MessageId, ProjectId, RunId, TaskId } from "../shared/ids";
import type { Task } from "../tasks/contracts";
import type { UsageEvent } from "../usage/contracts";

export interface ProjectRepository { findById(id: ProjectId, owner: OwnershipContext): Promise<Project | null>; save(value: Project): Promise<void> }
export interface ConversationRepository { findById(id: ConversationId, owner: OwnershipContext): Promise<Conversation | null>; save(value: Conversation): Promise<void> }
export interface MessageRepository { findById(id: MessageId, owner: OwnershipContext): Promise<Message | null>; append(value: Message): Promise<void> }
export interface ArtifactRepository { findById(id: ArtifactId, owner: OwnershipContext): Promise<Artifact | null>; save(value: Artifact): Promise<void> }
export interface RunRepository { findById(id: RunId, owner: OwnershipContext): Promise<AgentRun | null>; save(value: AgentRun): Promise<void> }
export interface TaskRepository { findById(id: TaskId, owner: OwnershipContext): Promise<Task | null>; save(value: Task): Promise<void> }
export interface FileRepository { findById(id: FileId, owner: OwnershipContext): Promise<FileAsset | null>; save(value: FileAsset): Promise<void> }
export interface UsageRepository { append(value: UsageEvent): Promise<void> }
export interface AuditRepository { append(value: AuditEvent): Promise<void> }

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { User } from "@/api/types";
import type { AdminStorage as StorageData } from "@/features/storage/useStorage";
import type { PermissionName } from "./useAdmin";

vi.mock("@/api/config", () => ({ API_URL: "http://api.test" }));
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<typeof fetch>();
  globalThis.fetch = mock;
  return mock;
});

import { AdminUsers } from "./AdminUsers";
import { AdminStorage } from "./AdminStorage";
import { AdminPage } from "./AdminPage";
import { StorageUserRow } from "./storage/StorageUserRow";
import { StorageMeter } from "@/features/storage/StorageMeter";

const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
  fetchMock.mockReset();
});

function makeClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  clients.push(client);
  return client;
}

function person(id: number, names: PermissionName[] = []): User {
  return {
    id,
    username: `User ${id}`,
    permissions: names.map((name, index) => ({ id: index, name })),
  } as User;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

it("keeps a quota draft and explains a failed save", async () => {
  const client = makeClient();
  fetchMock.mockResolvedValue(json({ message: "Quota update failed" }, 503));
  render(
    <QueryClientProvider client={client}>
      <StorageUserRow
        user={{
          id: 2,
          username: "Alice",
          group: "user",
          usedBytes: 0,
          quotaBytes: 1024,
          quotaOverridden: true,
        }}
        canEdit
      />
    </QueryClientProvider>,
  );
  const input = screen.getByLabelText("Storage limit for Alice");
  await userEvent.clear(input);
  await userEvent.type(input, "2.5");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Quota update failed");
  expect(input).toHaveValue("2.5");
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
});

it("shows a zero storage quota as full and an unlimited quota without a bar", async () => {
  const client = makeClient();
  client.setQueryData(["me", "storage"], { usedBytes: 0, quotaBytes: 0 });
  render(
    <QueryClientProvider client={client}>
      <StorageMeter />
    </QueryClientProvider>,
  );
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  act(() => client.setQueryData(["me", "storage"], { usedBytes: 100, quotaBytes: null }));
  await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
});

it("navigates authorized tabs by keyboard and hides a selected panel after permission revocation", async () => {
  const client = makeClient();
  client.setQueryData(["me"], person(1, ["admin_panel_access", "view_users_info"]));
  client.setQueryData(["admin", "users", { search: "", status: "", userType: "all", page: 0 }], {
    data: [],
    pageInfo: { total: 0 },
  });
  fetchMock.mockImplementation(async () => json({ message: "Unavailable" }, 503));
  render(
    <QueryClientProvider client={client}>
      <AdminPage />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  const overview = screen.getByRole("tab", { name: "Overview" });
  overview.focus();
  await user.keyboard("{ArrowRight}");
  const users = screen.getByRole("tab", { name: "Users" });
  expect(users).toHaveFocus();
  expect(users).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Users");
  expect(overview).toHaveAttribute("tabindex", "-1");
  act(() => client.setQueryData(["me"], person(1, ["admin_panel_access"])));
  await waitFor(() => expect(screen.queryByRole("tab", { name: "Users" })).toBeNull());
  expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Overview");
  expect(overview).toHaveAttribute("aria-selected", "true");
});

it("keeps a user's confirmation and permission draft through list refresh and failed save", async () => {
  const client = makeClient();
  const me = person(1, ["view_users_info", "manage_permissions", "ban_users"]);
  const target = person(2);
  const queryKey = ["admin", "users", { search: "", status: "", userType: "all", page: 0 }];
  const list = { data: [me, target], pageInfo: { total: 2 } };
  const moderator: PermissionName[] = ["admin_panel_access", "view_users_info", "ban_users"];
  client.setQueryData(queryKey, list);
  client.setQueryData(["admin", "roles"], {
    roles: [{ id: "moderator", permissions: moderator }],
    permissions: moderator,
  });
  const saves: unknown[] = [];
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    if (request.method === "PUT") {
      expect(new URL(request.url).pathname).toBe("/v1/admin/api/users/2/permissions");
      saves.push(await request.json());
      return saves.length === 1 ? json({ message: "Try again" }, 500) : json({});
    }
    expect(new URL(request.url).pathname).toBe("/v1/admin/api/users");
    return json(list);
  });
  render(
    <QueryClientProvider client={client}>
      <AdminUsers me={me} />
    </QueryClientProvider>,
  );
  const input = userEvent.setup();
  const row = within(screen.getAllByTestId("admin-user")[1]!);
  expect(within(screen.getAllByTestId("admin-user")[0]!).queryByRole("button")).toBeNull();
  await input.click(row.getByRole("button", { name: "Ban" }));
  await input.click(row.getByRole("button", { name: "Role…" }));
  const editor = within(row.getByTestId("staff-editor"));
  await input.selectOptions(editor.getByLabelText("Role", { exact: true }), "moderator");
  await input.click(editor.getByLabelText("Ban and unban"));
  act(() =>
    client.setQueryData(queryKey, {
      ...list,
      data: [me, { ...target, email: "updated@example.test", permissions: me.permissions }],
    }),
  );
  expect(row.getByRole("button", { name: "Confirm ban" })).toBeVisible();
  expect(editor.getByLabelText("Ban and unban")).not.toBeChecked();
  await input.click(editor.getByRole("button", { name: "Save" }));
  expect(await editor.findByRole("alert")).toHaveTextContent("Try again");
  expect(editor.getByLabelText("Ban and unban")).not.toBeChecked();
  await input.click(editor.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(row.queryByTestId("staff-editor")).toBeNull());
  expect(saves).toEqual([
    { permissions: ["admin_panel_access", "view_users_info"] },
    { permissions: ["admin_panel_access", "view_users_info"] },
  ]);
});

it("keeps raw storage drafts through refreshed limits and submits decimal or default quotas", async () => {
  const client = makeClient();
  const mb = 1024 * 1024;
  const limits = {
    group: "user",
    userQuotaBytes: 10 * mb,
    packageBytes: 1024,
    imageBytes: mb,
    audioBytes: 2 * mb,
    videoBytes: 4 * mb,
  };
  let data = {
    bucket: { usedBytes: 100, quotaBytes: null, fileCount: 1 },
    groups: [limits],
    topUsers: [
      {
        id: 2,
        username: "Alice",
        group: "user",
        usedBytes: 100,
        quotaBytes: mb,
        quotaOverridden: true,
      },
    ],
  } as StorageData;
  client.setQueryData(["admin", "storage"], data);
  const saves: { path: string; body: unknown }[] = [];
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    if (request.method === "GET") return json(data);
    const path = new URL(request.url).pathname;
    const body = await request.json();
    saves.push({ path, body });
    if (path.endsWith("/groups/user"))
      data = { ...data, groups: [{ ...data.groups[0]!, ...body }] };
    return json({});
  });
  render(
    <QueryClientProvider client={client}>
      <AdminStorage me={person(1, ["manage_storage"])} />
    </QueryClientProvider>,
  );
  const input = userEvent.setup();
  const group = within(screen.getByTestId("storage-group-user"));
  const picture = group.getByLabelText(/One picture/);
  await input.clear(picture);
  await input.type(picture, "oops");
  expect(group.getByRole("button", { name: "Save" })).toBeDisabled();
  await input.clear(picture);
  await input.type(picture, "1,5");
  const userQuota = screen.getByLabelText("Storage limit for Alice");
  await input.clear(userQuota);
  data = {
    ...data,
    groups: [{ ...data.groups[0]!, imageBytes: 3 * mb }],
    topUsers: [{ ...data.topUsers[0]!, quotaBytes: 2 * mb }],
  };
  act(() => client.setQueryData(["admin", "storage"], data));
  expect(picture).toHaveValue("1,5");
  expect(userQuota).toHaveValue("");
  await input.click(group.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(group.getByRole("button", { name: "Save" })).toBeDisabled());
  expect(picture).toHaveValue("1,5");
  await input.click(
    within(screen.getByTestId("storage-user")).getByRole("button", { name: "Save" }),
  );
  await waitFor(() => expect(saves).toHaveLength(2));
  expect(saves).toEqual([
    {
      path: "/v1/admin/api/storage/groups/user",
      body: {
        userQuotaBytes: 10 * mb,
        packageBytes: 1024,
        imageBytes: 1.5 * mb,
        audioBytes: 2 * mb,
        videoBytes: 4 * mb,
      },
    },
    { path: "/v1/admin/api/storage/users/2", body: { quotaBytes: null } },
  ]);
});

import { CATEGORIES } from '../../data/categories.js';
import { PERMISSIONS, ROLE_LIST } from '../../data/roles.js';
import {
  DEPARTMENTS,
  KIND_LIST,
  NOTIFICATION_TYPES,
  STATUS_LIST,
} from '../../data/workflow.js';
import {
  Badge,
  CategoryBadge,
  KindBadge,
  PageHeader,
  Panel,
  RoleBadge,
  StatusBadge,
} from '../../components/admin/ui.jsx';

/*
 * SYSTEM - what the platform recognises, and where it is defined.
 *
 * This page was called "Settings", which promised something it does not
 * offer: there is nothing here to set. It is a read-only description of the
 * platform's vocabulary, so it is named for what it is.
 *
 * Everything the panel adapts itself to is listed here, showing an
 * administrator exactly what the system currently recognises - and showing a
 * developer where to change it.
 *
 * The lists are read from the same data files the rest of the app reads, so
 * this page cannot go stale: add a category, a status, a department or a role
 * and it appears here, in the filters, in the charts and on the forms, without
 * anybody editing this file. That is the "future update compatibility" the
 * brief asked for, made visible.
 *
 * These are shown read-only on purpose. They are the platform's vocabulary,
 * and changing one - retiring a status, say - has to be a code change that
 * goes through review, not a text box that can be edited during a demo and
 * leave existing records pointing at something that no longer exists.
 *
 * WHAT YOU'LL MEET IN THIS FILE (plain-English notes)
 *
 * - Everything drawn here is `.map` over a list imported from data/ - the
 *   page has no data of its own, which is why it can never disagree with
 *   the rest of the app.
 * - `Object.keys(PERMISSIONS).length`  How many permissions exist. A role
 *   holding that many holds everything, so it gets one "Everything" badge
 *   instead of twelve.
 * - `permission.replace(/_/g, ' ')`  Turn 'moderate_posts' into 'moderate
 *   posts' for display. The `g` flag means "every underscore, not just the
 *   first".
 */

/*
 * `source` is optional. Four of these panels read the same file, and four
 * identical "Defined in src/data/workflow.js" footers said one fact four
 * times - so that one is stated once, under the grid, and only a list living
 * somewhere else names its own file here.
 */
function ConfigList({ description, source, children }) {
  return (
    <div>
      <p className="text-sm text-slate-600">{description}</p>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
      {source && <p className="mt-3 font-mono text-xs text-slate-400">Defined in {source}</p>}
    </div>
  );
}

function System() {
  return (
    <>
      <PageHeader
        title="System"
        description="What the platform currently recognises, and where each list is defined. Nothing here is editable - these are the platform's vocabulary."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Categories" description="Used by the board, the post form and every filter.">
          <ConfigList
            description={`${CATEGORIES.length} categories. Adding one here adds it to the student post form, the navbar dropdown, the admin filters and the analytics charts at the same time.`}
            source="src/data/categories.js"
          >
            {CATEGORIES.map((category) => (
              <CategoryBadge key={category.slug} category={category.slug} />
            ))}
          </ConfigList>
        </Panel>

        <Panel title="Submission types" description="What a student can send in.">
          <ConfigList
            description="Types are grouped into two families, which is what the 'Suggestions (all)' and 'Concerns (all)' options filter by on All Submissions. Separately, a type marked for assignment is handed to a department when approved - that is what puts it in the Open Work queue and gives it the department controls in the review dialog."
          >
            {KIND_LIST.map((kind) => (
              <KindBadge key={kind.key} kind={kind.key} />
            ))}
          </ConfigList>
        </Panel>

        <Panel title="Statuses" description="The moderation and concern lifecycle.">
          <ConfigList
            description="Each status knows which statuses it may move to next, and whether posts holding it appear on the public board. The progress stepper in the review dialog draws itself from that - which steps are filled in, and which can be clicked - so the workflow can be changed without touching any screen."
          >
            {STATUS_LIST.map((status) => (
              <StatusBadge key={status.key} status={status.key} />
            ))}
          </ConfigList>

          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Visible on the student board
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STATUS_LIST.filter((status) => status.public).map((status) => (
                <StatusBadge key={status.key} status={status.key} />
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Departments" description="Who a concern can be assigned to.">
          <ConfigList
            description={`${DEPARTMENTS.length} departments available in the assignment dropdown, and the rows of the Departments page - which counts what each one is carrying and how long it is taking.`}
          >
            {DEPARTMENTS.map((department) => (
              <Badge key={department.key} className="bg-slate-100 text-slate-700">
                {department.label}
              </Badge>
            ))}
          </ConfigList>
        </Panel>

        <Panel title="Notification types" description="What the system tells people about.">
          <ConfigList
            description="Each type names its audience, so a new one is delivered to the right people without any caller having to work it out."
          >
            {Object.values(NOTIFICATION_TYPES).map((type) => (
              <Badge key={type.key} className="bg-slate-100 text-slate-700">
                {type.label}
                <span className="ml-1.5 text-slate-400">
                  {type.audience === 'admin' ? 'admins' : 'author'}
                </span>
              </Badge>
            ))}
          </ConfigList>
        </Panel>
      </div>

      <p className="mt-3 text-center font-mono text-xs text-slate-400">
        Submission types, statuses, departments and notification types are all defined in
        src/data/workflow.js
      </p>

      {/* ROLES AND WHAT THEY MAY DO. */}
      <Panel
        className="mt-4"
        title="Roles and permissions"
        description="One account system. The role on an account decides where it lands after login and what it may do."
      >
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                {['Role', 'Lands on', 'Permissions'].map((heading) => (
                  <th
                    key={heading}
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLE_LIST.map((role) => (
                <tr key={role.key} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-3 align-top">
                    <RoleBadge role={role.key} />
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-xs text-slate-500">{role.home}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {role.permissions.length === Object.keys(PERMISSIONS).length ? (
                        <Badge className="bg-purple-100 text-purple-800">Everything</Badge>
                      ) : (
                        role.permissions.map((permission) => (
                          <Badge key={permission} className="bg-slate-100 text-slate-600">
                            {permission.replace(/_/g, ' ')}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 font-mono text-xs text-slate-400">Defined in src/data/roles.js</p>
      </Panel>

      {/* WHERE THE RECORDS LIVE, and what actually protects them. */}
      <Panel className="mt-4" title="Data and security">
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            <strong className="text-navy-900">Storage:</strong> every account, submission, vote,
            notification and log entry is kept on the server, in its database (
            <code className="font-mono text-xs">backend/</code>). The student site and this panel
            read the same records through{' '}
            <code className="font-mono text-xs">src/services/store.js</code>, and every change is
            sent to the server.
          </p>
          <p>
            <strong className="text-navy-900">Permissions:</strong> the server checks the signed-in
            account's role again on every request. The menus and route guards in this panel only
            decide what is shown - hiding a button is never what stops an action.
          </p>
        </div>
      </Panel>
    </>
  );
}

export default System;

-- Apply this in the Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text,
  p_related_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, related_id, is_read)
  VALUES (p_user_id, p_title, p_message, p_type, p_related_id, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_board_member_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'Pending' THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'Board invite',
      'You have been invited to collaborate on a board.',
      'board_invite',
      NEW.board_id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_task_due_reminder_for_task(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task record;
  v_days integer;
  v_title text;
  v_msg text;
  v_user uuid;
BEGIN
  SELECT t.id, t.name, t.board_id, t.assigned_to, t.status, t.due_date, b.name AS board_name
  INTO v_task
  FROM public.tasks t
  LEFT JOIN public.boards b ON b.id = t.board_id
  WHERE t.id = p_task_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_task.assigned_to IS NULL OR v_task.status = 'done' OR v_task.due_date IS NULL THEN
    RETURN;
  END IF;

  -- `date - date` returns an integer number of days in Postgres, so avoid calling
  -- date_part with an integer which causes "function date_part(unknown, integer) does not exist".
  v_days := (v_task.due_date::date - CURRENT_DATE)::int;

  IF v_days < 0 THEN
    DELETE FROM public.notifications
    WHERE user_id = ANY(v_task.assigned_to)
      AND type = 'task_due'
      AND related_id = p_task_id;
    RETURN;
  END IF;

  IF v_days > 2 THEN
    RETURN;
  END IF;

  IF v_days = 0 THEN
    v_title := 'Task due today';
    v_msg := format('"%s" in "%s" is due today.', v_task.name, COALESCE(v_task.board_name, 'the board'));
  ELSIF v_days = 1 THEN
    v_title := 'Task due tomorrow';
    v_msg := format('"%s" in "%s" is due tomorrow.', v_task.name, COALESCE(v_task.board_name, 'the board'));
  ELSE
    v_title := 'Task due soon';
    v_msg := format('"%s" in "%s" is due in 2 days.', v_task.name, COALESCE(v_task.board_name, 'the board'));
  END IF;

  -- create a reminder per assigned user
  FOR v_user IN SELECT unnest(v_task.assigned_to) LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.notifications
      WHERE user_id = v_user
        AND type = 'task_due'
        AND related_id = p_task_id
        AND message = v_msg
    ) THEN
      PERFORM public.create_notification(v_user, v_title, v_msg, 'task_due', p_task_id);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_task_due_reminder_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM public.tasks
    WHERE assigned_to IS NOT NULL
      AND status <> 'done'
      AND due_date IS NOT NULL
  LOOP
    PERFORM public.send_task_due_reminder_for_task(r.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_task_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_board_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Notify each assignee (skip creator) and schedule reminders
    IF NEW.assigned_to IS NOT NULL AND NEW.status <> 'done' THEN
      FOR v_user IN SELECT unnest(NEW.assigned_to) LOOP
        IF v_user IS DISTINCT FROM NEW.created_by THEN
          PERFORM public.create_notification(
            v_user,
            'Task assigned',
            format('You were assigned "%s".', NEW.name),
            'task_assigned',
            NEW.id
          );
        END IF;
      END LOOP;

      IF NEW.due_date IS NOT NULL THEN
        PERFORM public.send_task_due_reminder_for_task(NEW.id);
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Notify newly added assignees (skip creator)
    IF NEW.assigned_to IS NOT NULL AND NEW.status <> 'done' THEN
      IF OLD.assigned_to IS NULL THEN
        FOR v_user IN SELECT unnest(NEW.assigned_to) LOOP
          IF v_user IS DISTINCT FROM NEW.created_by THEN
            PERFORM public.create_notification(
              v_user,
              'Task assigned',
              format('You were assigned "%s".', NEW.name),
              'task_assigned',
              NEW.id
            );
          END IF;
        END LOOP;
      ELSE
        FOR v_user IN SELECT unnest(NEW.assigned_to) LOOP
          IF NOT (v_user = ANY(OLD.assigned_to)) AND v_user IS DISTINCT FROM NEW.created_by THEN
            PERFORM public.create_notification(
              v_user,
              'Task assigned',
              format('You were assigned "%s".', NEW.name),
              'task_assigned',
              NEW.id
            );
          END IF;
        END LOOP;
      END IF;
    END IF;

    IF NEW.status = 'done' AND OLD.status <> 'done' THEN
      DELETE FROM public.notifications
      WHERE type = 'task_due'
        AND related_id = NEW.id;

      SELECT name INTO v_board_name
      FROM public.boards
      WHERE id = NEW.board_id;

      IF NEW.created_by IS NOT NULL THEN
        PERFORM public.create_notification(
          NEW.created_by,
          'Task completed',
          format('Task "%s" in "%s" was completed.', NEW.name, COALESCE(v_board_name, 'the board')),
          'task_completed',
          NEW.id
        );
      END IF;

      IF NEW.assigned_to IS NOT NULL THEN
        FOR v_user IN SELECT unnest(NEW.assigned_to) LOOP
          IF v_user IS DISTINCT FROM NEW.created_by THEN
            PERFORM public.create_notification(
              v_user,
              'Task completed',
              format('Task "%s" in "%s" was completed.', NEW.name, COALESCE(v_board_name, 'the board')),
              'task_completed',
              NEW.id
            );
          END IF;
        END LOOP;
      END IF;
    END IF;

    IF NEW.assigned_to IS NOT NULL AND NEW.status <> 'done' AND NEW.due_date IS NOT NULL THEN
      PERFORM public.send_task_due_reminder_for_task(NEW.id);
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS board_members_notify ON public.board_members;
CREATE TRIGGER board_members_notify
AFTER INSERT OR UPDATE ON public.board_members
FOR EACH ROW
EXECUTE FUNCTION public.notify_board_member_changes();

DROP TRIGGER IF EXISTS tasks_notify ON public.tasks;
CREATE TRIGGER tasks_notify
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_task_changes();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'flowboard-task-reminders',
      '*/15 * * * *',
      'SELECT public.send_task_due_reminder_notifications();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

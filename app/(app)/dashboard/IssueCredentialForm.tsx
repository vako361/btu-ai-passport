'use client';

import { useActionState } from 'react';
import { issueCredentialAction, type IssueState } from './actions';
import { SubmitButton } from '@/components/ui/SubmitButton';

interface Option {
  id: number;
  label: string;
}

interface IssueCredentialFormProps {
  students: Option[];
  skills: Option[];
  defaultDate: string;
  defaultStudentId?: number;
}

const initialState: IssueState = {};

const fieldClass =
  'h-12 w-full rounded-lg border bg-white px-3 text-[15px] font-medium outline-none transition-all focus:border-[#FE017E] focus:ring-1 focus:ring-[#FE017E]';

export function IssueCredentialForm({ students, skills, defaultDate, defaultStudentId }: IssueCredentialFormProps) {
  const [state, formAction] = useActionState(issueCredentialAction, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="studentId" className="text-xs font-bold uppercase tracking-wider text-gray-500">Student</label>
          <select
            id="studentId"
            name="studentId"
            defaultValue={defaultStudentId ?? ''}
            aria-invalid={errors.studentId ? true : undefined}
            className={`${fieldClass} ${errors.studentId ? 'border-red-400' : 'border-gray-200'}`}
          >
            <option value="" disabled>Select a student</option>
            {students.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}
          </select>
          {errors.studentId ? <p className="text-sm text-red-600">{errors.studentId}</p> : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="skillId" className="text-xs font-bold uppercase tracking-wider text-gray-500">Verified skill</label>
          <select
            id="skillId"
            name="skillId"
            defaultValue=""
            aria-invalid={errors.skillId ? true : undefined}
            className={`${fieldClass} ${errors.skillId ? 'border-red-400' : 'border-gray-200'}`}
          >
            <option value="" disabled>Select a skill</option>
            {skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.label}</option>)}
          </select>
          {errors.skillId ? <p className="text-sm text-red-600">{errors.skillId}</p> : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="earnedAt" className="text-xs font-bold uppercase tracking-wider text-gray-500">Date earned</label>
          <input
            id="earnedAt"
            name="earnedAt"
            type="date"
            defaultValue={defaultDate}
            max={defaultDate}
            aria-invalid={errors.earnedAt ? true : undefined}
            className={`${fieldClass} ${errors.earnedAt ? 'border-red-400' : 'border-gray-200'}`}
          />
          {errors.earnedAt ? <p className="text-sm text-red-600">{errors.earnedAt}</p> : null}
        </div>
      </div>

      <SubmitButton
        pendingLabel="Issuing and registering..."
        className="h-12 rounded-xl bg-[#FE017E] px-8 text-white shadow-lg shadow-pink-500/20 hover:bg-[#d6006a]"
      >
        Issue credential
      </SubmitButton>
    </form>
  );
}

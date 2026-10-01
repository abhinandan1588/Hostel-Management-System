import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { CheckCircle2, ClipboardList, Info, Send, TriangleAlert } from 'lucide-react'
import { toast } from 'react-toastify'

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  FormErrors,
  PageHeader,
  SelectField,
  TextArea,
  TextField,
  applyServerErrors,
} from '../../components/common'
import { studentPortalService } from '../../services'
import { SUGGESTION_CATEGORIES, optionsFrom } from '../../utils/labels'

const FIELDS = ['subject', 'category', 'message']

const CATEGORY_OPTIONS = optionsFrom(SUGGESTION_CATEGORIES)

const GUIDANCE = [
  'Something in your room needs repair - a light, fan, tap, window or bed.',
  'A problem with the food: quantity, taste, hygiene or a missed meal.',
  'Study time is too noisy, or you need help with a subject.',
  'You are feeling unwell and a warden has not been told yet.',
  'Something about school: transport, homework time or a lost item.',
  'Anything else that is making hostel life difficult for you.',
]

/**
 * Student issue report.
 *
 * This creates a report for the warden. It is not an official record and it
 * changes nothing in attendance, health, school or progress data.
 */
export default function StudentReportIssue() {
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [sent, setSent] = useState(null)

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: { subject: '', category: 'GENERAL', message: '' },
  })

  const submit = async (values) => {
    setSubmitting(true)
    setServerError(null)
    try {
      const report = await studentPortalService.reportIssue({
        subject: values.subject,
        category: values.category || 'GENERAL',
        message: values.message,
      })
      toast.success('Your report has been sent to the warden.')
      setSent(report)
      reset({ subject: '', category: 'GENERAL', message: '' })
    } catch (err) {
      const mapped = applyServerErrors(err, setError, FIELDS)
      if (!mapped) setServerError(err)
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const startAnother = () => {
    setSent(null)
    setServerError(null)
    reset({ subject: '', category: 'GENERAL', message: '' })
  }

  return (
    <>
      <PageHeader
        title="Report an issue"
        subtitle="Tell the warden about a problem - nothing in your records changes"
      />

      <div
        className="mb-4 flex gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3"
        role="note"
      >
        <TriangleAlert className="mt-0.5 h-4.5 w-4.5 shrink-0 text-red-600" aria-hidden="true" />
        <p className="text-sm text-red-900">
          <strong>In an emergency, find a warden in person straight away.</strong> This form is read
          during office hours, so it is not the right way to ask for urgent help.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {sent ? (
            <Card>
              <CardBody>
                <div className="flex gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold text-slate-900">Report sent</h2>
                    <p className="muted mt-1">
                      The warden has been notified and will look at it. You will get a notification
                      here when they reply.
                    </p>
                    {sent.subject && (
                      <dl className="mt-3 space-y-1 rounded-xl bg-slate-50 px-3.5 py-3 text-sm">
                        <div className="flex gap-2">
                          <dt className="font-semibold text-slate-600">Subject</dt>
                          <dd className="min-w-0 text-slate-800">{sent.subject}</dd>
                        </div>
                        {sent.category && (
                          <div className="flex gap-2">
                            <dt className="font-semibold text-slate-600">Category</dt>
                            <dd className="text-slate-800">{sent.category.replace(/_/g, ' ')}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                    <p className="hint mt-3">
                      This is a report, not a change to any official record. Attendance, health,
                      school and progress entries stay exactly as staff recorded them.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button icon={ClipboardList} onClick={startAnother}>
                        Report something else
                      </Button>
                      <Link to="/student/dashboard" className="btn-secondary">
                        Back to dashboard
                      </Link>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader
                title="What would you like to tell the warden?"
                subtitle="Be specific so it can be sorted out quickly"
                icon={ClipboardList}
              />
              <CardBody>
                <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
                  <FormErrors error={serverError} ignoreFields={FIELDS} />

                  <TextField
                    label="Subject"
                    required
                    placeholder="Fan in room 204 is not working"
                    hint="A short title, 3 to 180 characters."
                    error={errors.subject?.message}
                    {...register('subject', {
                      required: 'Write a short subject.',
                      minLength: { value: 3, message: 'Use at least 3 characters.' },
                      maxLength: { value: 180, message: 'Keep the subject under 180 characters.' },
                    })}
                  />

                  <SelectField
                    label="Category"
                    required
                    options={CATEGORY_OPTIONS}
                    error={errors.category?.message}
                    {...register('category', { required: 'Choose a category.' })}
                  />

                  <TextArea
                    label="What happened?"
                    required
                    rows={6}
                    placeholder="Explain the problem, when it started and anything you have already tried."
                    hint="At least 5 characters. Add times, room numbers and names where you can."
                    error={errors.message?.message}
                    {...register('message', {
                      required: 'Describe the problem.',
                      minLength: { value: 5, message: 'Add a little more detail.' },
                      maxLength: { value: 5000, message: 'Please shorten this to 5000 characters.' },
                    })}
                  />

                  <p className="hint">
                    Submitting this sends a report to the warden. It does not change your
                    attendance, health, school or progress records.
                  </p>

                  <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                    <Button type="submit" icon={Send} loading={submitting}>
                      Send report
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader title="What can I report?" icon={Info} />
          <CardBody>
            <ul className="space-y-2.5">
              {GUIDANCE.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-slate-600">
                  <span
                    className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
            <p className="hint mt-4">
              Your parents can also raise suggestions from their own portal. Wardens see both.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  )
}

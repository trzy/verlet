using System.Collections.Generic;
using UnityEngine;

namespace Verlet
{
  public interface IConstraint
  {
    void Solve();
  }

  public interface IBody
  {
    float mass { get; set; }
    Vector3 position { get; set; }
    void Update(float deltaTime);
    void SolveConstraints();
    void AddForce(Vector3 force);
    void AddConstraint(IConstraint constraint);
  }

  public class LinkConstraint: IConstraint
  {
    private IBody m_body1;
    private IBody m_body2;
    private float m_maxLength;
    private float m_stiffness;

    public void Solve()
    {
      Vector3 delta = m_body1.position - m_body2.position;
      float distance = delta.magnitude;
      Vector3 dir = delta / distance;
      float p1 = m_body2.mass / (m_body1.mass + m_body2.mass);
      float p2 = m_body1.mass / (m_body1.mass + m_body2.mass);
      float adjustment1 = m_stiffness * p1 * (distance - m_maxLength);
      float adjustment2 = m_stiffness * p2 * (distance - m_maxLength);
      m_body1.position = m_body1.position - adjustment1 * dir;
      m_body2.position = m_body2.position + adjustment2 * dir;
    }

    public LinkConstraint(IBody body1, IBody body2, float length, float stiffness = 1)
    {
      m_body1 = body1;
      m_body2 = body2;
      m_maxLength = length;
      m_stiffness = stiffness;
    }
  }

  public class ConstraintSolver
  {
    private List<IConstraint> m_constraints;

    public void SolveConstraints()
    {
      foreach (IConstraint constraint in m_constraints)
      {
        constraint.Solve();
      }
    }

    public void AddConstraint(IConstraint constraint)
    {
      m_constraints.Add(constraint);
    }

    public ConstraintSolver()
    {
      m_constraints = new List<IConstraint>();
    }
  }

  public class Anchor: ConstraintSolver, IBody
  {
    private Transform m_transform;
    private Joint m_joint;
    private Vector3 m_position;

    public float mass
    {
      //TODO: mass should be infinite but we need to rework PointMass solver to use inverted masses in order for that to work
      get { return 1e9f; }
      set { }
    }

    public Vector3 position
    {
      get { return m_position; }
      set { }
    }

    public void Update(float deltaTime)
    {
      if (m_transform)
        m_position = m_transform.position;
      else if (m_joint)
        m_position = m_joint.gameObject.transform.TransformPoint(m_joint.anchor);
    }

    public void AddForce(Vector3 force)
    {
    }

    public Anchor(Vector3 p)
    {
      m_transform = null;
      m_joint = null;
      m_position = p;
    }

    public Anchor(Transform anchoredTo)
    {
      m_transform = anchoredTo;
      m_joint = null;
      m_position = anchoredTo.position;
    }

    public Anchor(Joint anchoredTo)
    {
      m_transform = null;
      m_joint = anchoredTo;
      m_position = m_joint.gameObject.transform.TransformPoint(m_joint.anchor);
    }
  }

  public class PointMass: ConstraintSolver, IBody
  {
    private Vector3 m_position;
    private Vector3 m_lastPosition;
    private Vector3 m_acceleration = Vector3.zero;
    private float m_mass;

    public float mass
    {
      get { return m_mass; }
      set { m_mass = value; }
    }

    public Vector3 position
    {
      get { return m_position; }
      set { m_position = value; }
    }

    public void Update(float deltaTime)
    {
      float deltaTime2 = deltaTime * deltaTime;
      Vector3 nextPosition = m_position + (m_position - m_lastPosition) + m_acceleration * deltaTime2;
      m_lastPosition = m_position;
      m_position = nextPosition;
    }

    public void AddForce(Vector3 force)
    {
      m_acceleration += force / mass;
    }

    public PointMass(Vector3 p, float m)
    {
      position = p;
      m_lastPosition = p;
      mass = m;
    }
  }

  public class System
  {
    private List<IBody> m_bodies;
    private float m_timeLeftOver = 0;

    public void Update(float timeSinceLastCalled)
    {
      int constraintIterations = 1;
      float timeStep = 1 / 120f;
      float deltaTime = timeSinceLastCalled + m_timeLeftOver;
      int numWholeSteps = Mathf.FloorToInt(deltaTime / timeStep);
      m_timeLeftOver = deltaTime - numWholeSteps * timeStep;
      for (int step = 0; step < numWholeSteps; step++)
      {
        for (int i = 0; i < constraintIterations; i++)
        {
          foreach (IBody body in m_bodies)
          {
            body.SolveConstraints();
          }
        }
        foreach (IBody body in m_bodies)
        {
          body.Update(timeStep);
        }
      }
    }

    public void AddBody(IBody body)
    {
      m_bodies.Add(body);
      Debug.Log("Added body at " + body.position.ToString("F3"));
    }

    public System()
    {
      m_bodies = new List<IBody>();
    }
  }
}
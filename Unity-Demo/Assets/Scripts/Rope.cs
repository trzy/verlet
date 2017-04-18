using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class Rope: MonoBehaviour
{
  public float ropeLength = 1;
  public int numSegments = 10;
  private Verlet.System m_verlet;
  private List<Verlet.IBody> m_bodies;
  private GameObject m_lineObject;
  private LineRenderer m_line;

  private void Update()
  {
    m_verlet.Update(Time.deltaTime);
    for (int i = 0; i < m_bodies.Count; i++)
    {
      m_line.SetPosition(i, m_bodies[i].position);
    }
  }

  private void Awake()
  {
    m_verlet = new Verlet.System();
    m_bodies = new List<Verlet.IBody>();

    // Construct rope with anchor assumed to be at pivot of this object
    Verlet.Anchor anchor = new Verlet.Anchor(transform);
    m_verlet.AddBody(anchor);
    m_bodies.Add(anchor);
    float segmentLength = ropeLength / numSegments;
    for (int i = 1; i < numSegments; i++)
    {
      Verlet.PointMass point = new Verlet.PointMass(transform.position - segmentLength * transform.up * i, 1);
      Verlet.IBody lastPoint = m_bodies[m_bodies.Count - 1];
      Verlet.IConstraint link = new Verlet.LinkConstraint(lastPoint, point, (point.position - lastPoint.position).magnitude, 1f);
      point.AddConstraint(link);
      point.AddForce(new Vector3(0, -9.8f * point.mass, 0));
      m_verlet.AddBody(point);
      m_bodies.Add(point);
    }

    // Debug line renderer
    m_lineObject = new GameObject("line");
    m_line = m_lineObject.AddComponent<LineRenderer>();
    m_line.startWidth = .01f;
    m_line.endWidth = .01f;
    m_line.startColor = Color.red;
    m_line.endColor = Color.red;
    m_line.positionCount = numSegments;
  }
}
